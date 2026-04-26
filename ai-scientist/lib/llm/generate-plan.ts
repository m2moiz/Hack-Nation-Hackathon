import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ExperimentPlanSchema, type ExperimentPlan } from '@/lib/schema';
import { MOCK_PLAN } from '@/data/mock-plan';

interface Protocol {
  id: string;
  title: string;
  source: string;
  doi: string;
  url: string;
  year: number;
  domain: string[];
  experimentType: string;
  summary: string;
}

interface BudgetConstants {
  laborRates: Record<string, number>;
  equipmentTimeRates: Record<string, number>;
  overheadRates: {
    institutional_overhead_fraction: number;
    consumables_markup_fraction: number;
  };
  contingencyPercentRecommended: number;
}

function loadProtocols(): Protocol[] {
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'protocols.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function loadBudgetConstants(): BudgetConstants | null {
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'budget_constants.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function filterRelevantProtocols(protocols: Protocol[], hypothesis: string): Protocol[] {
  if (protocols.length === 0) return [];
  const keywords = hypothesis.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const scored = protocols
    .map((p) => {
      const titleText = p.title.toLowerCase();
      const summaryText = p.summary.toLowerCase();
      let score = 0;
      score += keywords.filter((kw) => titleText.includes(kw)).length * 2;
      score += keywords.filter((kw) => summaryText.includes(kw)).length;
      for (const d of p.domain) {
        if (keywords.some((kw) => d.includes(kw))) score += 2;
      }
      return { p, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ p }) => p);
  return scored;
}

// Q2 — strip hallucinated DOIs: keep refs that contain a known DOI substring,
// remove refs that look like DOIs but don't match any known protocol.
function sanitizeProtocolRefs(plan: ExperimentPlan, allProtocols: Protocol[]): ExperimentPlan {
  const knownDois = allProtocols.map((p) => p.doi.toLowerCase());
  const looksLikeDoi = /10\.\d{4,}\/\S+/;

  return {
    ...plan,
    protocol: plan.protocol.map((step) => ({
      ...step,
      protocolRefs: step.protocolRefs.filter((ref) => {
        const r = ref.toLowerCase();
        if (knownDois.some((doi) => r.includes(doi))) return true;
        if (looksLikeDoi.test(r)) return false; // DOI-shaped but unknown → hallucination
        return true; // free-text ref (manufacturer notes, etc.) → keep
      }),
    })),
  };
}

function buildBudgetSection(bc: BudgetConstants): string {
  const lr = bc.laborRates;
  const eq = bc.equipmentTimeRates;
  return `Budget rules — use these EXACT rates for budget line items:
Labor: technician €${lr.lab_technician_per_hour}/h, postdoc €${lr.postdoc_per_hour}/h, PhD student €${lr.phd_student_per_hour}/h, senior scientist €${lr.senior_scientist_per_hour}/h
Equipment: flow cytometer €${eq.flow_cytometer_per_hour}/h, confocal €${eq.confocal_microscope_per_hour}/h, HPLC €${eq.hplc_per_hour}/h, potentiostat €${eq.potentiostat_per_day}/day, qPCR €${eq.qpcr_machine_per_run}/run, plate reader €${eq.plate_reader_per_hour}/h, anaerobic chamber €${eq.anaerobic_chamber_per_day}/day, LN2 storage €${eq.liquid_nitrogen_storage_per_week}/week
Overhead: ${(bc.overheadRates.institutional_overhead_fraction * 100).toFixed(0)}% institutional overhead on direct costs. Contingency: ${bc.contingencyPercentRecommended}%.
Calculate each labor/equipment budget line from actual time estimate × rate. Do not use vague round numbers.`;
}

const BASE_SYSTEM_PROMPT = `You are a senior research scientist designing rigorous laboratory experiments.
Rules:
- All work assumes a BSL-2 lab environment.
- All prices must be in EUR.
- Only use suppliers from this approved list: Sigma-Aldrich, Thermo Fisher, Addgene, ATCC, IDT, Promega, Qiagen, NEB, Bio-Rad, Other.
- Do not invent references. Only cite sources provided in the literature context or protocol context.
- For protocolRefs in each protocol step, only cite DOIs from the provided protocol context, formatted as "DOI: <doi> — <title>". Never invent a DOI.
- Novelty assessment: read every abstract and title in the literature context carefully. Set noveltyCheck.status to "exact_match" if a paper tests the same intervention on the same model, "similar_exists" if related work exists, "novel" only if no comparable study appears in the provided literature. Your rationale must explicitly reference the titles found.
- Validation criteria must be quantitative and binary: every threshold field must contain a specific number with units (e.g. "≥85% post-thaw viability", "LOD ≤ 0.5 mg/L", "p < 0.05 by Student t-test"). Never write vague thresholds like "improved" or "significant".
- Be precise, realistic, and complete.`;

const MAX_ATTEMPTS = 2;

export async function generatePlan(
  hypothesis: string,
  catalogContext: string = '',
  papersContext: string = '',
): Promise<ExperimentPlan> {
  if (!process.env.OPENAI_API_KEY) return MOCK_PLAN;

  const client = new OpenAI();
  const allProtocols = loadProtocols();
  const budgetConstants = loadBudgetConstants();
  const relevantProtocols = filterRelevantProtocols(allProtocols, hypothesis);

  const systemPrompt = budgetConstants
    ? `${BASE_SYSTEM_PROMPT}\n\n${buildBudgetSection(budgetConstants)}`
    : BASE_SYSTEM_PROMPT;

  const protocolContext =
    relevantProtocols.length > 0
      ? relevantProtocols
          .map((p) => `- DOI: ${p.doi} — ${p.title} (${p.source}, ${p.year}): ${p.summary}`)
          .join('\n')
      : '';

  const userPrompt = `Hypothesis: ${hypothesis}

${papersContext ? `Relevant literature:\n${papersContext}\n` : ''}
${catalogContext ? `Available reagents from catalog:\n${catalogContext}\n` : ''}
${protocolContext ? `Reference protocols (only cite these DOIs in protocolRefs, never invent one):\n${protocolContext}\n` : ''}
Design a complete experiment plan for this hypothesis.`;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const completion = await client.chat.completions.parse({
        model: 'gpt-4o-2024-08-06',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: zodResponseFormat(ExperimentPlanSchema, 'experiment_plan'),
      });

      const plan = completion.choices[0].message.parsed;
      if (!plan) throw new Error('OpenAI returned no parsed output');

      return sanitizeProtocolRefs(plan, allProtocols);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) continue;
    }
  }

  throw lastError;
}
