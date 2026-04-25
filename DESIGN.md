# DESIGN.md — Ground Truth Document

**Project:** AI Scientist (Hack-Nation 5, Fulcrum Track)
**Team:** 4 people, Paris hub
**Build window:** Sat 19:15 → Sun 15:00 CEST
**Status:** Locked. This is the source of truth.

---

## Table of contents

1. [What we are building](#1-what-we-are-building)
2. [Architecture overview](#2-architecture-overview)
3. [Tech stack](#3-tech-stack)
4. [The five features](#4-the-five-features)
5. [Schemas: complete reference](#5-schemas-complete-reference)
6. [API endpoints: complete reference](#6-api-endpoints-complete-reference)
7. [How features map to schemas and endpoints](#7-how-features-map-to-schemas-and-endpoints)
8. [Data flow diagrams](#8-data-flow-diagrams)
9. [Constraint check (OpenAI strict mode)](#9-constraint-check-openai-strict-mode)
10. [Repository file structure](#10-repository-file-structure)
11. [System prompt rules](#11-system-prompt-rules)
12. [Pre-hub checklist](#12-pre-hub-checklist)
13. [Sunday morning integration plan](#13-sunday-morning-integration-plan)

---

## 1. What we are building

A web app that takes a scientific hypothesis as natural-language input and produces a fact-checkable, operationally complete experiment plan that a real lab could execute. The plan includes a literature novelty check, full protocol with citations, materials with real catalog numbers, budget, timeline, and validation criteria. Every factual claim is traceable to a source. The user can explore related literature in a graph view, leave structured corrections on any part of the plan, and watch future plans for similar experiments incorporate those corrections.

The product targets the Fulcrum challenge bar: "would a real scientist trust this enough to order materials Monday and start running it Friday?" The answer is yes because every claim in the plan is sourced, every reagent has a real catalog number with a verifiable URL, every step lists its critical parameters, and every outcome has a primary or secondary classification with a measurable success threshold.

---

## 2. Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js (Vercel)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Hypothesis   │  │ Plan view    │  │ Literature graph     │   │
│  │ input        │→ │ (streaming)  │↔ │ (Obsidian-style)     │   │
│  └──────────────┘  └──────┬───────┘  └──────────┬───────────┘   │
│                           │                     │               │
│                           ↓                     ↓               │
│                    ┌──────────────────────────────────┐         │
│                    │ Interactive feedback canvas      │         │
│                    │ (text selections + region tags)  │         │
│                    └──────────────────────────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┬─────────────┐
              ↓              ↓              ↓             ↓
       ┌──────────┐    ┌──────────┐  ┌──────────┐  ┌──────────────┐
       │ /api/qc  │    │/api/plan │  │ /api/lit │  │ /api/feedback│
       │ (novelty)│    │(generate)│  │  (graph) │  │  (corrections)│
       └────┬─────┘    └────┬─────┘  └────┬─────┘  └──────┬───────┘
            │               │             │               │
            ↓               ↓             ↓               ↓
       ┌────────┐      ┌──────────┐  ┌─────────┐    ┌─────────┐
       │ Tavily │      │ OpenAI   │  │ Tavily  │    │ Supabase│
       │        │      │ GPT-4o   │  │ + cache │    │ pgvector│
       └────────┘      └────┬─────┘  └─────────┘    └─────────┘
                            │
                ┌───────────┼───────────────────┐
                │           │                   │
          ┌─────▼────┐ ┌────▼─────┐    ┌────────▼───────┐
          │ Catalog  │ │Protocols │    │ Source URL     │
          │ (JSON)   │ │ (JSON)   │    │ allowlist      │
          │ 150 items│ │ 30 items │    │ (validator)    │
          └──────────┘ └──────────┘    └────────────────┘
```

**Single Next.js app on Vercel.** Frontend and backend live in the same repo. API routes are serverless functions. No microservices, no Docker, no Kubernetes.

**No persistent user state.** Each session is independent. Plans live in browser memory and Supabase only stores feedback (for the few-shot retrieval stretch goal).

**Strict separation of concerns.** The `lib/schema.ts` file is the contract. Frontend and backend both import from it. No copy-paste types.

---

## 3. Tech stack

```bash
npm install zod openai zod-to-json-schema @tavily/core @supabase/supabase-js
npm install -D tsx @types/node
```

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Vercel-native, API routes, streaming SSR |
| Hosting | Vercel | Sponsor credits, one-click deploy, edge runtime |
| Language | TypeScript | Required for Zod, type safety across stack |
| Validation | Zod | Single schema → TS types + runtime validation + JSON Schema |
| LLM | OpenAI GPT-4o-2024-08-06 | Best structured-outputs reliability (100% schema compliance per their evals) |
| Search | Tavily | Hackathon credits, AI-optimized, returns LLM-ready content |
| Database | Supabase (Postgres + pgvector) | Only used for feedback storage (stretch goal) |
| UI components | shadcn/ui + Tailwind | Lovable scaffolds these natively, clean defaults |
| Graph view | Cytoscape.js or React Flow | Pick whichever has cleaner API for the graph mode |
| Initial scaffold | Lovable | 30-minute scaffold then export to GitHub |
| Refinement | Cursor + Claude Code | All subsequent work |

---

## 4. The five features

### Feature 1: Hypothesis-to-plan generation
The core flow. User types a hypothesis, gets back a complete experiment plan. Streams in section-by-section. Demo-critical.

### Feature 2: Literature novelty check (graph view)
Initial card shows a quick novelty signal with 2-3 references. Clicking "explore" opens an Obsidian-style graph where nodes are papers and edges are relationships. Users can click a paper to see details and expand neighbors.

### Feature 3: Citation-grounded fact-checking
Every factual claim in the plan is linked to a source. Hovering a claim shows the source excerpt and a link to the original. Inferred claims (model reasoning, not directly cited) get a different visual treatment so users know what to scrutinize.

### Feature 4: Interactive feedback canvas
Users can select arbitrary text spans, click on figure regions (timeline phases, budget pie chart cells, materials table rows), and leave structured comments. Comments are tagged with severity (critical/major/minor/suggestion).

### Feature 5: Few-shot feedback loop (stretch goal)
Saved corrections feed back into future plan generation. When a user submits a similar hypothesis later, the system retrieves relevant past corrections by experiment_type/domain/tags and injects them as few-shot examples in the system prompt. The next plan visibly reflects the corrections.

---

## 5. Schemas: complete reference

All schemas live in `lib/schema.ts`. Single file, single source of truth. Both frontend and backend import from here.

### 5.1 Shared enums

These are used across multiple schemas. Defining them once prevents drift.

```typescript
import { z } from 'zod';

export const ExperimentType = z.enum([
  'in_vitro',
  'in_vivo',
  'ex_vivo',
  'electrochemical',
  'microbial',
  'computational',
  'other',
]);

export const Domain = z.enum([
  'diagnostics',
  'gut_health',
  'cell_biology',
  'climate',
  'oncology',
  'neuroscience',
  'immunology',
  'cardiology',
  'other',
]);

export const NoveltyStatus = z.enum([
  'novel',
  'similar_exists',
  'exact_match',
]);

export const SourceKind = z.enum([
  'paper',
  'preprint',
  'protocol',
  'supplier_catalog',
  'database',
  'guideline',
  'inferred',
]);

export const MaterialCategory = z.enum([
  'reagent',
  'antibody',
  'cell_line',
  'consumable',
  'kit',
  'organism',
  'other',
]);

export const Supplier = z.enum([
  'Sigma-Aldrich',
  'Thermo Fisher',
  'Addgene',
  'ATCC',
  'IDT',
  'Promega',
  'Qiagen',
  'NEB',
  'Bio-Rad',
  'Abcam',
  'R&D Systems',
  'Other',
]);

export const Currency = z.enum(['EUR', 'USD', 'GBP']);

export const BudgetCategory = z.enum([
  'reagents',
  'consumables',
  'equipment_purchase',
  'equipment_rental',
  'personnel',
  'sequencing',
  'animal_costs',
  'overhead',
  'contingency',
  'other',
]);

export const Confidence = z.enum(['low', 'medium', 'high']);

export const OutcomePriority = z.enum(['primary', 'secondary']);

export const ControlType = z.enum([
  'positive',
  'negative',
  'vehicle',
  'comparator',
  'blank',
]);

export const CorrectionSeverity = z.enum([
  'critical',
  'major',
  'minor',
  'suggestion',
]);

export const PaperRelationship = z.enum([
  'cites',
  'similar_topic',
  'contradicts',
  'extends',
  'related_method',
]);

export const FigureType = z.enum([
  'timeline',
  'budget_chart',
  'materials_table',
  'protocol_flow',
  'literature_graph',
]);
```

**Rationale:** enums are the single biggest defense against hallucination. The `Supplier` enum in particular blocks the model from inventing fake suppliers, which is otherwise a constant problem with structured outputs. Every enum here is finite and chosen to cover the four example hypothesis domains in the Fulcrum brief.

### 5.2 The citation system

This is the foundation of fact-checkability. Used throughout the experiment plan.

```typescript
export const SourceCitation = z.object({
  id: z.string(),                  // "SRC-001", "SRC-002", etc.
  kind: SourceKind,
  title: z.string(),
  url: z.string(),
  doi: z.string().nullable(),
  year: z.number().nullable(),
  excerpt: z.string(),             // verbatim quote supporting the claim
}).strict();

export const Claim = z.object({
  field_path: z.string(),          // e.g. "protocol.steps[2].description"
  span: z.string().nullable(),     // optional substring within the field
  citation_ids: z.array(z.string()), // refs to SourceCitation.id
  inferred: z.boolean(),           // true = model reasoning, no external source
  inferred_rationale: z.string(),  // explanation when inferred=true
}).strict();
```

**Rationale:** the `SourceCitation` is a flat record with everything needed to verify a claim: the URL, the DOI for canonical lookup, the verbatim excerpt that the model says supports the claim. The `Claim` array is a parallel structure that maps locations in the plan (by field_path) to citations. This separation keeps citation metadata out of the plan content itself, which keeps the property count manageable.

**Critical design choice:** the `excerpt` field must contain a verbatim quote from the source, not a paraphrase. This enables post-hoc validation: we can re-fetch the URL and check that the excerpt actually appears in the page content. This is the one validation that actually catches hallucinated citations.

**The `inferred` boolean is the trust mechanism.** When the model can't ground a claim in a source, it's required to set `inferred: true` with a rationale. The UI then renders these claims with a dotted underline (vs. solid for sourced claims). A scientist sees at a glance what's grounded vs. what's the model's guess.

### 5.3 Sub-schemas for the experiment plan

```typescript
export const NoveltyCheck = z.object({
  status: NoveltyStatus,
  summary: z.string(),
  citation_ids: z.array(z.string()), // refs to SourceCitation.id
}).strict();

export const ProtocolStep = z.object({
  step_number: z.number(),
  title: z.string(),
  description: z.string(),
  duration_minutes: z.number(),
  critical_parameters: z.array(z.string()),
  warnings: z.array(z.string()),
  materials_used: z.array(z.string()), // refs to Material.id
  citation_ids: z.array(z.string()),   // refs to SourceCitation.id
}).strict();

export const Protocol = z.object({
  title: z.string(),
  steps: z.array(ProtocolStep),
  citation_ids: z.array(z.string()),   // protocol-level source citations
}).strict();

export const Alternative = z.object({
  name: z.string(),
  supplier: Supplier,
  catalog_number: z.string(),
  note: z.string(),
}).strict();

export const Material = z.object({
  id: z.string(),                       // "MAT-001"
  name: z.string(),
  category: MaterialCategory,
  supplier: Supplier,
  catalog_number: z.string(),
  url: z.string(),
  quantity: z.string(),
  unit_cost_eur: z.number(),
  total_cost_eur: z.number(),
  lead_time_days: z.number(),
  alternative: Alternative.nullable(),
  citation_id: z.string(),              // single ref to SourceCitation (the supplier catalog entry)
}).strict();

export const Materials = z.object({
  items: z.array(Material),
  total_cost_eur: z.number(),
  longest_lead_time_days: z.number(),
}).strict();

export const EquipmentItem = z.object({
  name: z.string(),
  spec: z.string(),
  required: z.boolean(),
}).strict();

export const BudgetLine = z.object({
  category: BudgetCategory,
  description: z.string(),
  cost: z.number(),
  material_ids: z.array(z.string()),    // refs to Material.id
  citation_ids: z.array(z.string()),    // refs for non-material costs (rate cards, etc.)
}).strict();

export const Budget = z.object({
  currency: Currency,
  line_items: z.array(BudgetLine),
  contingency_pct: z.number(),
  total: z.number(),
  confidence: Confidence,
}).strict();

export const TimelinePhase = z.object({
  phase_number: z.number(),
  name: z.string(),
  week_start: z.number(),
  week_end: z.number(),
  tasks: z.array(z.string()),
  dependencies: z.array(z.number()),    // refs to other phase_number values
  milestone: z.string(),
}).strict();

export const Timeline = z.object({
  total_weeks: z.number(),
  phases: z.array(TimelinePhase),
  critical_path_notes: z.string(),
}).strict();

export const Outcome = z.object({
  priority: OutcomePriority,
  metric: z.string(),
  target_value: z.string(),
  measurement_method: z.string(),
  success_threshold: z.string(),
  citation_ids: z.array(z.string()),
}).strict();

export const Control = z.object({
  type: ControlType,
  description: z.string(),
}).strict();

export const FailureMode = z.object({
  scenario: z.string(),
  likely_cause: z.string(),
  remediation: z.string(),
  citation_ids: z.array(z.string()),
}).strict();

export const Validation = z.object({
  outcomes: z.array(Outcome),
  controls: z.array(Control),
  statistical_approach: z.string(),
  failure_modes: z.array(FailureMode),
}).strict();
```

**Rationale on key decisions:**

- **Material IDs (`MAT-001`)** create a queryable graph. Protocol steps reference materials via `materials_used`, budget lines reference them via `material_ids`. The frontend can do "click MAT-001 → highlight every step that uses it → show its budget contribution → flag if its lead time means we need to order today."

- **`critical_parameters` as `string[]` not nested objects.** The original design was nested objects with name/value/rationale, but that pushed nesting depth to 6, exceeding OpenAI's strict mode 5-level cap. Flattened to strings like `"N₂ purity ≥99.998% (prevents surface oxidation)"`. Tiny structural loss, schema compatibility win.

- **`citation_ids` everywhere.** Every object that contains a factual claim gets one. This is what makes fact-checking work end to end. The model is forced (via system prompt) to cite or set `inferred: true`.

- **`alternative` is nullable.** Most materials don't need a fallback supplier listed. Nullable union (`Alternative | null`) keeps strict mode happy while letting the field be optional in practice.

- **`controls` is required, not optional.** A plan without controls fails scientific review. The model may produce an empty array if controls genuinely don't apply, but the field itself is always present.

- **Primary vs. secondary outcomes** via priority enum, not separate arrays. Real trials always distinguish primary and secondary endpoints. A single array with priority labels is cleaner than two parallel arrays.

- **Budget total is the model's responsibility.** We force the model to commit to a total number rather than computing it ourselves. This catches arithmetic errors and lets us sanity-check.

### 5.4 The main experiment plan schema

```typescript
export const ExperimentPlanSchema = z.object({
  hypothesis: z.string(),
  summary: z.string(),
  experiment_type: ExperimentType,
  domain: Domain,
  novelty_check: NoveltyCheck,
  assumptions: z.array(z.string()),
  protocol: Protocol,
  materials: Materials,
  equipment: z.array(EquipmentItem),
  budget: Budget,
  timeline: Timeline,
  validation: Validation,
  sources: z.array(SourceCitation),
  claims: z.array(Claim),
}).strict();

export type ExperimentPlan = z.infer<typeof ExperimentPlanSchema>;
```

**Rationale on field ordering:** OpenAI generates output left-to-right, so cheap fast-streaming fields go first. `hypothesis` is just an echo (instant). `summary` is a 1-2 sentence overview (1-2 seconds). `experiment_type` and `domain` are single-token classifications (sub-second). `novelty_check` streams in next, giving the user something visible while the heavy sections (`protocol`, `materials`, `budget`) generate. `sources` and `claims` come last because they reference the rest of the plan and only make sense once the content exists.

### 5.5 Literature graph schema

This is a separate schema for the graph view. It is NOT part of the experiment plan. Returned by the `/api/literature/graph` endpoint.

**Why separate:** the graph view is interactive and grows over time as users click to expand neighbors. Embedding it in the plan would mean either including hundreds of papers in every plan generation (expensive) or limiting the graph to whatever was in the initial novelty check. Separating it lets the graph live independently and grow on demand.

```typescript
export const PaperEdge = z.object({
  to_paper_id: z.string(),         // refs another LiteraturePaper.id
  relationship: PaperRelationship,
  strength: z.number(),            // 0.0 to 1.0, drives edge thickness
}).strict();

export const LiteraturePaper = z.object({
  id: z.string(),                  // "PAPER-001"
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number(),
  source: SourceKind,
  url: z.string(),
  doi: z.string().nullable(),
  abstract_snippet: z.string(),    // ~2 sentences for the hover card
  relevance_score: z.number(),     // 0.0 to 1.0, drives node size
  is_seed: z.boolean(),            // true if from original search, false if from expansion
  edges: z.array(PaperEdge),
}).strict();

export const LiteratureGraph = z.object({
  query: z.string(),               // the original hypothesis or paper title
  papers: z.array(LiteraturePaper),
  generated_at: z.string(),        // ISO timestamp
}).strict();

export type LiteratureGraphType = z.infer<typeof LiteratureGraph>;
```

**Rationale:** the `is_seed` boolean lets the UI visually distinguish papers from the original search vs. papers discovered through expansion. The `relevance_score` drives node size in the visualization. Edges have both type and strength so the UI can render different edge styles (citation = solid, similar topic = dashed, contradicts = red).

### 5.6 Feedback schemas

The feedback endpoint accepts three different feedback types. Each is its own sub-schema, all bundled in `FeedbackSchema`.

```typescript
// Type 1: structured field corrections
export const FieldCorrection = z.object({
  field_path: z.string(),          // e.g. "materials.items[2].catalog_number"
  issue: z.string(),
  correction: z.string(),
  severity: CorrectionSeverity,
}).strict();

// Type 2: text-anchored comments (selected text spans)
export const TextSelection = z.object({
  field_path: z.string(),          // section the selection is in
  start_offset: z.number(),        // character offset
  end_offset: z.number(),
  selected_text: z.string(),       // verbatim, for context if section drifts
}).strict();

export const SelectionComment = z.object({
  id: z.string(),                  // "COMMENT-001"
  selection: TextSelection,
  comment: z.string(),
  severity: CorrectionSeverity,
  resolved: z.boolean(),
}).strict();

// Type 3: figure-anchored comments (regions on rendered visualizations)
export const FigureRegion = z.object({
  figure_type: FigureType,
  x: z.number(),                   // normalized 0-1 coordinates
  y: z.number(),
  width: z.number(),
  height: z.number(),
  context: z.string(),             // what was at that location, e.g. "phase 3"
}).strict();

export const RegionComment = z.object({
  id: z.string(),                  // "COMMENT-002"
  region: FigureRegion,
  comment: z.string(),
  severity: CorrectionSeverity,
  resolved: z.boolean(),
}).strict();

// Composite: full feedback payload
export const FeedbackSchema = z.object({
  plan_id: z.string(),             // server-generated UUID linking to original plan
  experiment_type: ExperimentType,
  domain: Domain,
  field_corrections: z.array(FieldCorrection),
  selection_comments: z.array(SelectionComment),
  region_comments: z.array(RegionComment),
  used_as_few_shot: z.boolean(),
  few_shot_tags: z.array(z.string()),
}).strict();

export type Feedback = z.infer<typeof FeedbackSchema>;
```

**Rationale:** three feedback types cover three interaction modes. Field corrections are the canonical case (scientist edits a known field with a known issue). Selection comments handle "I disagree with this sentence in the protocol description but there's no obvious field to edit." Region comments handle "this phase in the timeline gantt chart looks wrong" or "this segment of the budget pie chart is wrong." All three feed into the few-shot retrieval, but field corrections are weighted highest because they're the most structured.

The `plan_id` links feedback back to the original plan, enabling audit trails and "show all feedback for this plan" views.

### 5.7 Mock plan (drop into `data/mock-plan.ts`)

A complete valid `ExperimentPlan` that satisfies the schema. The frontend builds against this in Phase 2 (home async work). Validates at module load.

The mock has been prepared as a separate code block to keep this section readable. See `data/mock-plan.ts` in the repo. Key elements:

- 7 materials with cross-referenced IDs (MAT-001 through MAT-007)
- 6 protocol steps with `materials_used` linking back to materials
- 9 budget line items with `material_ids` cross-references
- 5 timeline phases with `dependencies` cross-references
- 3 outcomes (1 primary, 2 secondary)
- 3 controls and 3 failure modes
- 8 source citations (SRC-001 through SRC-008) covering papers, protocols, and supplier catalogs
- 14 claims linking specific plan locations to citations, with 2 marked `inferred: true`

The mock validates against the schema at module load. If the schema changes and the mock drifts, the build fails immediately.

---

## 6. API endpoints: complete reference

### 6.1 Endpoint summary

| Endpoint | Method | Returns | Latency | Streaming | Auth |
|---|---|---|---|---|---|
| `/api/qc` | POST | `NoveltyCheck` | 2-4s | No | None |
| `/api/plan` | POST | `ExperimentPlan` | 10-30s | Yes | None |
| `/api/literature/graph` | GET | `LiteratureGraph` | 3-8s | No | None |
| `/api/literature/expand` | GET | `LiteraturePaper[]` | 2-5s | No | None |
| `/api/feedback` | POST | `{success, feedbackId}` | <1s | No | None |
| `/api/health` | GET | health status | <1s | No | None |

No auth on any endpoint. This is a hackathon demo. Add auth post-hackathon if we keep building.

### 6.2 POST /api/qc — Novelty check

**Purpose:** the fast first-stage check. "Has this been done before?" Runs in parallel with the user reading the hypothesis they just typed. UX win.

**Request:**
```typescript
{
  hypothesis: string;
}
```

**Response:** `NoveltyCheck` from `lib/schema.ts` (status, summary, citation_ids), plus the `sources` array those citations reference.

```typescript
{
  novelty_check: NoveltyCheck;
  sources: SourceCitation[];
}
```

**Implementation sketch:**

```typescript
// app/api/qc/route.ts
import { NoveltyCheck, SourceCitation } from '@/lib/schema';
import { tavily } from '@tavily/core';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });

const QCResponseSchema = z.object({
  novelty_check: NoveltyCheck,
  sources: z.array(SourceCitation),
}).strict();

export async function POST(req: Request) {
  const { hypothesis } = await req.json();

  // 1. Tavily search across protocols.io, arxiv, pubmed
  const searchResults = await tavilyClient.search(hypothesis, {
    searchDepth: 'advanced',
    includeDomains: [
      'protocols.io',
      'arxiv.org',
      'pubmed.ncbi.nlm.nih.gov',
      'biorxiv.org',
      'semanticscholar.org',
    ],
    maxResults: 8,
  });

  // 2. Classify novelty + extract verifiable citations
  const completion = await openai.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: NOVELTY_CLASSIFIER_PROMPT },
      {
        role: 'user',
        content: `Hypothesis: ${hypothesis}\n\nSearch results:\n${JSON.stringify(searchResults.results)}`,
      },
    ],
    response_format: zodResponseFormat(QCResponseSchema, 'qc_response'),
  });

  const result = completion.choices[0].message.parsed!;

  // 3. Validate every source URL is from an allowlisted domain
  for (const src of result.sources) {
    if (!isAllowlistedUrl(src.url)) {
      throw new Error(`Source URL not allowlisted: ${src.url}`);
    }
  }

  return Response.json(result);
}
```

**Why separate from `/api/plan`:** runs in 2-4 seconds (one Tavily call + one GPT-4o-mini classification). The frontend shows the QC card while the user waits for the plan to start streaming. Without this split, the user stares at a spinner for 30 seconds.

### 6.3 POST /api/plan — Full experiment plan generation

**Purpose:** the main event. Generates the full `ExperimentPlan` matching the schema.

**Request:**
```typescript
{
  hypothesis: string;
  novelty_check?: NoveltyCheck;     // optional, from /api/qc
  qc_sources?: SourceCitation[];    // optional, from /api/qc
}
```

We accept the prior novelty check so the planner doesn't re-do the literature search. Saves 2-4 seconds of generation time.

**Response:** Server-Sent Events stream of the `ExperimentPlan`. The OpenAI SDK handles this via `chat.completions.stream`.

**Implementation sketch:**

```typescript
// app/api/plan/route.ts
import { ExperimentPlanSchema } from '@/lib/schema';
import { findRelevantReagents } from '@/lib/catalog';
import { findRelevantProtocols } from '@/lib/protocols';
import { getFeedbackExamples } from '@/lib/feedback';
import { classifyExperimentTags } from '@/lib/llm/classify-tags';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { randomUUID } from 'crypto';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { hypothesis, novelty_check, qc_sources } = await req.json();
  const planId = randomUUID();

  // 1. Classify the experiment for catalog/protocol/feedback retrieval
  const tags = await classifyExperimentTags(hypothesis);

  // 2. Retrieve relevant context (RAG)
  const catalogContext = findRelevantReagents(tags, 30);
  const protocolContext = findRelevantProtocols(tags, 10);
  const feedbackContext = await getFeedbackExamples(tags, 3); // empty if no feedback yet

  // 3. Stream the plan
  const stream = await openai.chat.completions.stream({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: PLAN_GENERATOR_PROMPT },
      {
        role: 'user',
        content: buildUserPrompt({
          hypothesis,
          noveltyCheck: novelty_check,
          qcSources: qc_sources,
          catalogContext,
          protocolContext,
          feedbackContext,
        }),
      },
    ],
    response_format: zodResponseFormat(ExperimentPlanSchema, 'experiment_plan'),
  });

  // 4. Return as Server-Sent Events
  return new Response(stream.toReadableStream(), {
    headers: {
      'Content-Type': 'text/event-stream',
      'X-Plan-Id': planId, // expose for feedback linking
    },
  });
}
```

**Critical design choices:**

1. **The plan_id is generated server-side**, not by the LLM. UUIDs are not what LLMs are good at. We pass it back in a response header.

2. **Streaming via OpenAI SDK's native stream parser.** It handles partial JSON gracefully. The frontend consumes via `for await (const chunk of stream)` and renders sections as they arrive.

3. **Feedback examples are injected silently.** The user never knows their previous corrections are influencing the next plan. This is what makes the stretch goal demo magical.

### 6.4 GET /api/literature/graph — Initial graph view

**Purpose:** when the user clicks "explore literature" from the QC card, fetch a richer graph of related papers.

**Request (query params):**
```
?hypothesis=<encoded text>
?seed_paper_ids=PAPER-001,PAPER-002  (optional, if expanding from existing seeds)
```

**Response:** `LiteratureGraph` (the schema with papers + edges).

**Implementation sketch:**

```typescript
// app/api/literature/graph/route.ts
import { LiteratureGraph } from '@/lib/schema';
import { tavily } from '@tavily/core';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const hypothesis = url.searchParams.get('hypothesis');
  const seedIds = url.searchParams.get('seed_paper_ids')?.split(',') ?? [];

  // 1. Tavily search for relevant papers (cast wider net than QC)
  const results = await tavilyClient.search(hypothesis!, {
    searchDepth: 'advanced',
    maxResults: 15,
    includeDomains: [
      'protocols.io', 'arxiv.org', 'pubmed.ncbi.nlm.nih.gov',
      'biorxiv.org', 'semanticscholar.org', 'nature.com', 'science.org',
    ],
  });

  // 2. Build graph nodes from results
  const papers = results.results.map((r, i) => ({
    id: `PAPER-${String(i + 1).padStart(3, '0')}`,
    title: r.title,
    authors: extractAuthors(r.content), // best-effort regex extraction
    year: extractYear(r.url, r.title),
    source: classifySource(r.url),
    url: r.url,
    doi: extractDoi(r.content),
    abstract_snippet: r.content.slice(0, 280),
    relevance_score: r.score, // Tavily provides relevance scores
    is_seed: !seedIds.length, // initial query papers are seeds
    edges: [], // computed below
  }));

  // 3. Compute edges based on title similarity, shared authors, citation overlap
  papers.forEach(p => {
    p.edges = computeEdges(p, papers);
  });

  return Response.json({
    query: hypothesis,
    papers,
    generated_at: new Date().toISOString(),
  } satisfies LiteratureGraph);
}
```

**Why no LLM in this endpoint:** the graph view is about relationships between real papers. Tavily already returns relevance scores. Edge computation is structural (shared authors, similar titles, overlapping abstracts). Adding an LLM here would slow things down without adding value.

### 6.5 GET /api/literature/expand — Expand from a paper

**Purpose:** when the user clicks a node in the graph, fetch its neighbors (related papers).

**Request:**
```
?paper_id=PAPER-005&paper_url=<url>
```

**Response:** `LiteraturePaper[]` (new papers discovered, with edges back to the seed).

**Implementation:** searches Tavily for "papers related to <title of paper_id>" and returns the top 5 with edges pointing back to the seed paper. Graph view merges these into the existing graph.

### 6.6 POST /api/feedback — Save feedback

**Purpose:** receive scientist corrections from the interactive feedback canvas.

**Request:** the full `Feedback` payload from `lib/schema.ts`.

**Response:**
```typescript
{
  success: boolean;
  feedbackId: string;
  fewShotEligible: boolean; // true if this feedback will influence future plans
}
```

**Implementation sketch:**

```typescript
// app/api/feedback/route.ts
import { FeedbackSchema } from '@/lib/schema';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  const json = await req.json();
  const validated = FeedbackSchema.parse(json);

  // Insert into Supabase
  const { data, error } = await supabase
    .from('feedback_examples')
    .insert({
      plan_id: validated.plan_id,
      experiment_type: validated.experiment_type,
      domain: validated.domain,
      field_corrections: validated.field_corrections,
      selection_comments: validated.selection_comments,
      region_comments: validated.region_comments,
      used_as_few_shot: validated.used_as_few_shot,
      few_shot_tags: validated.few_shot_tags,
    })
    .select('id')
    .single();

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    feedbackId: data.id,
    fewShotEligible: validated.used_as_few_shot,
  });
}
```

**Database schema (Supabase):**
```sql
create table feedback_examples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  plan_id uuid not null,
  experiment_type text not null,
  domain text not null,
  field_corrections jsonb not null default '[]',
  selection_comments jsonb not null default '[]',
  region_comments jsonb not null default '[]',
  used_as_few_shot boolean not null default true,
  few_shot_tags text[] not null default array[]::text[]
);

create index feedback_tags_idx on feedback_examples using gin(few_shot_tags);
create index feedback_type_domain_idx on feedback_examples(experiment_type, domain);
```

### 6.7 GET /api/health — Health check

**Purpose:** Sunday morning sanity check. Hit the URL, get fast yes/no on whether the deployment is alive and env vars are set.

**Response:**
```typescript
{
  ok: boolean;
  checks: {
    openai_key: boolean;
    tavily_key: boolean;
    supabase: boolean;
    catalog_loaded: number;     // count of loaded reagents
    protocols_loaded: number;   // count of loaded protocols
  };
}
```

10 lines of code. Saves 30 minutes of debugging Sunday morning when something silently doesn't work.

---

## 7. How features map to schemas and endpoints

This section shows which schemas and endpoints power which user-visible features.

### Feature 1: Hypothesis-to-plan generation

**User flow:** types hypothesis → submits → sees QC card → sees plan stream in.

**Schemas:** `ExperimentPlanSchema` (the whole thing), `NoveltyCheck`, `SourceCitation`, `Claim`.

**Endpoints:**
1. `POST /api/qc` first (2-4s)
2. `POST /api/plan` immediately after (10-30s, streaming)

**Critical code paths:**
- `lib/schema.ts` defines the contract
- `lib/llm/generate-plan.ts` orchestrates OpenAI call with structured outputs
- `lib/catalog.ts` provides RAG context for materials
- `lib/protocols.ts` provides RAG context for protocol references
- `app/components/PlanView.tsx` renders the streaming output

### Feature 2: Literature novelty check (graph view)

**User flow:** sees QC card with 2-3 references → clicks "explore" → graph opens → clicks a paper → graph expands.

**Schemas:** `LiteratureGraph`, `LiteraturePaper`, `PaperEdge`.

**Endpoints:**
1. `GET /api/literature/graph` (initial graph)
2. `GET /api/literature/expand` (on each click to expand)

**Critical code paths:**
- `app/components/LiteratureGraph.tsx` renders Cytoscape.js or React Flow
- `lib/graph/edges.ts` computes edges between papers (shared authors, title similarity, etc.)
- `lib/graph/scoring.ts` ranks papers by relevance

**Important:** the graph view is independent of the experiment plan. Users can explore the graph without a plan being generated, and a generated plan does not auto-populate the graph. The two views share the QC results as a starting point.

### Feature 3: Citation-grounded fact-checking

**User flow:** hovers a sentence in the plan → tooltip shows source excerpt + link → clicks → opens the original paper.

**Schemas:** `SourceCitation`, `Claim` (both inside `ExperimentPlanSchema`).

**Endpoints:** none new, this is purely client-side rendering of data already in the plan.

**Critical code paths:**
- `app/components/CitableText.tsx` wraps every claimable text span
- `app/components/SourceTooltip.tsx` renders the hover card with excerpt
- `lib/citations/lookup.ts` maps `field_path` strings to rendered DOM locations
- The system prompt enforces citation rules (see Section 11)

**Visual treatment:**
- Sourced claims: solid underline (subtle), hover shows tooltip
- Inferred claims: dotted underline, hover shows the rationale
- Audit mode toggle: shows all citations as inline badges instead of hover-only

### Feature 4: Interactive feedback canvas

**User flow:** selects text in the plan → comment popover appears → types comment → assigns severity → saves. Or clicks a region in a figure (timeline phase, budget cell) → same flow.

**Schemas:** `Feedback`, `FieldCorrection`, `SelectionComment`, `RegionComment`.

**Endpoints:** `POST /api/feedback`.

**Critical code paths:**
- `app/components/FeedbackCanvas.tsx` overlays the plan view
- `lib/feedback/text-selection.ts` uses browser Selection API to anchor comments
- `lib/feedback/region-anchor.ts` maps clicks on canvas/SVG figures to normalized coordinates
- `app/components/CommentPopover.tsx` renders the input UI

**Three feedback modes:**
1. **Field correction:** structured, when the user knows exactly which field is wrong (e.g., "wrong catalog number for MAT-002")
2. **Text selection:** when the issue spans natural language (e.g., "the description in step 3 implies the wrong centrifuge speed")
3. **Region:** when the issue is in a visual element (e.g., "phase 3 in the timeline gantt is too compressed")

### Feature 5: Few-shot feedback loop (stretch goal)

**User flow:** in a previous session, scientist corrected something. Later, scientist submits a similar hypothesis. The new plan visibly reflects the correction.

**Schemas:** `Feedback` (read), `ExperimentPlanSchema` (output).

**Endpoints:** `POST /api/plan` is enhanced to retrieve feedback before generating.

**Critical code paths:**
- `lib/feedback/retrieval.ts` queries Supabase for relevant past corrections
- `lib/llm/generate-plan.ts` injects retrieved corrections into the system prompt
- The system prompt has a section "Past corrections from scientists for similar experiments" that lists retrieved feedback verbatim

**Retrieval strategy:**
- Match by `experiment_type` (exact)
- Match by `domain` (exact)
- Tag overlap on `few_shot_tags`
- Order by `created_at DESC`
- Take top 3-5

For the demo, the retrieval is simple SQL with `WHERE experiment_type = ? AND domain = ?`. No vector similarity needed for the hackathon. Vector similarity (pgvector) is a nice-to-have if time permits.

---

## 8. Data flow diagrams

### 8.1 Plan generation flow

```
User types hypothesis
  │
  ↓
Frontend POST /api/qc { hypothesis }
  │
  ├─→ Tavily search across protocols.io + arxiv + pubmed
  │     ↓
  │   Returns 5-8 search results
  │     ↓
  ├─→ OpenAI gpt-4o-mini classify novelty
  │     ↓
  │   Returns NoveltyCheck + SourceCitation[]
  │     ↓
  └─→ URL allowlist validator
        ↓
      Frontend renders QC card (2-4s elapsed)
        ↓
Frontend POST /api/plan { hypothesis, novelty_check, qc_sources }
  │
  ├─→ Server generates plan_id (UUID)
  ├─→ classifyExperimentTags → ['cell_culture', 'cryopreservation']
  ├─→ findRelevantReagents → 30 catalog entries
  ├─→ findRelevantProtocols → 10 protocol references
  ├─→ getFeedbackExamples → 0-3 past corrections (stretch)
  │     ↓
  ├─→ OpenAI gpt-4o-2024-08-06 stream
  │     │ system: PLAN_GENERATOR_PROMPT
  │     │ user: hypothesis + qc + catalog + protocols + feedback
  │     │ response_format: ExperimentPlanSchema (strict)
  │     ↓
  │   Streams back JSON sections in schema order:
  │     hypothesis (instant)
  │     summary (1-2s)
  │     experiment_type, domain (instant after summary)
  │     novelty_check (already computed, instant)
  │     assumptions (2-3s)
  │     protocol (5-10s)
  │     materials (3-5s)
  │     equipment (2s)
  │     budget (3-5s)
  │     timeline (3-5s)
  │     validation (5s)
  │     sources (3s, references previous content)
  │     claims (3s, references previous content)
  │     ↓
  └─→ URL allowlist validator on every source
        ↓
      Frontend progressively renders sections (10-30s elapsed)
```

### 8.2 Literature graph flow

```
User clicks "Explore literature" from QC card
  ↓
Frontend GET /api/literature/graph?hypothesis=...
  ↓
Tavily search (advanced, 15 results)
  ↓
Build LiteraturePaper nodes from results
  ↓
Compute edges (shared authors, title similarity, citation overlap)
  ↓
Return LiteratureGraph
  ↓
Frontend renders Cytoscape.js / React Flow visualization
  ↓
User clicks a node
  ↓
Frontend GET /api/literature/expand?paper_id=PAPER-005&paper_url=...
  ↓
Tavily search for related papers
  ↓
Return LiteraturePaper[] with edges back to seed
  ↓
Frontend merges into existing graph (no duplicates)
```

### 8.3 Feedback flow

```
User reads plan, finds something wrong
  ↓
Three paths:
  │
  ├─→ Path A: Selects text in plan
  │     ↓
  │   Browser Selection API captures range
  │     ↓
  │   Comment popover appears at selection
  │     ↓
  │   User types comment, picks severity
  │     ↓
  │   Frontend builds SelectionComment
  │
  ├─→ Path B: Clicks on figure region
  │     ↓
  │   Click handler captures normalized x/y/w/h
  │     ↓
  │   Comment popover appears at click
  │     ↓
  │   Frontend builds RegionComment
  │
  └─→ Path C: Edits a known field directly
        ↓
      Inline editor (e.g., catalog_number cell in materials table)
        ↓
      User types new value
        ↓
      Frontend builds FieldCorrection

All three paths converge:
  ↓
Frontend POST /api/feedback with full Feedback payload
  ↓
Server validates against FeedbackSchema
  ↓
Insert into Supabase feedback_examples table
  ↓
Return success + feedbackId
  ↓
Frontend shows toast: "Saved. Future plans will reflect this."
```

### 8.4 Few-shot loop (stretch)

```
Scientist later submits a similar hypothesis
  ↓
POST /api/plan { hypothesis }
  ↓
Inside the endpoint:
  ↓
classifyExperimentTags → ['cell_culture', 'cryopreservation']
  ↓
getFeedbackExamples queries Supabase:
  SELECT * FROM feedback_examples
  WHERE experiment_type = 'in_vitro'
    AND domain = 'cell_biology'
    AND few_shot_tags && ARRAY['cryopreservation', 'cell_culture']
    AND used_as_few_shot = true
  ORDER BY created_at DESC
  LIMIT 3
  ↓
Retrieved corrections injected into system prompt:
  "Past corrections from scientists for similar experiments:
  - In a cell_biology cryopreservation experiment, a scientist corrected:
    'Use ATCC for HeLa cells, not Sigma. ATCC is the authoritative source.'
  - In a similar experiment, a scientist commented on phase 2 timing:
    'Cell expansion should be 5-7 days, not 3'."
  ↓
GPT-4o reads these as soft guidelines, reflects them in output
  ↓
New plan visibly incorporates the corrections
```

---

## 9. Constraint check (OpenAI strict mode)

OpenAI strict mode imposes hard limits. Violating any of them means structured outputs simply fail.

**Limit 1: Max 100 object properties total.**

Property count by section:
- Root (ExperimentPlan): 14
- SourceCitation: 7
- Claim: 5
- NoveltyCheck: 3
- Protocol: 3
- ProtocolStep: 8
- Materials: 3
- Material: 12
- Alternative: 4
- EquipmentItem: 3
- Budget: 5
- BudgetLine: 5
- Timeline: 3
- TimelinePhase: 7
- Outcome: 6
- Control: 2
- FailureMode: 4
- Validation: 4

**Total: 98 properties.** 2-property safety margin under the 100 cap.

**Limit 2: Max 5 levels of nesting.**

Deepest path: `ExperimentPlan → materials → items[] → Material → alternative`. That's 4 levels of object nesting (the strings inside Alternative are leaf primitives, not counted as nesting).

**Verdict: 4 levels max.** 1-level safety margin under the 5 cap.

**Limit 3: All fields must be in `required`.**

Every field is either always required or declared as nullable union (`type | null`). No truly optional fields. Zod's `.nullable()` produces the correct JSON Schema output (`"type": ["string", "null"]` with the field still in `required`).

**Limit 4: `additionalProperties: false`.**

Every Zod object uses `.strict()`, which sets `additionalProperties: false` in the generated JSON Schema. Confirmed across all 18 object schemas.

**Limit 5: No unsupported keywords.**

We don't use `minLength`, `maximum`, `pattern`, `oneOf`, `allOf`. Validation of those constraints happens post-hoc at runtime via Zod, not at generation time.

**Separate schemas (LiteratureGraph, FeedbackSchema):**

These are NOT used with OpenAI structured outputs. They're for endpoint request/response validation only. So OpenAI's limits don't apply to them.

`LiteratureGraph`: 13 properties total. No constraint concerns.
`FeedbackSchema`: 22 properties total. No constraint concerns.

---

## 10. Repository file structure

```
.
├── DESIGN.md                          ← this document, the source of truth
├── README.md                          ← short project description
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── .env.example                       ← all required env var names
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx                       ← main hypothesis input + plan view
│   ├── api/
│   │   ├── qc/route.ts
│   │   ├── plan/route.ts
│   │   ├── literature/
│   │   │   ├── graph/route.ts
│   │   │   └── expand/route.ts
│   │   ├── feedback/route.ts
│   │   └── health/route.ts
│   └── components/
│       ├── HypothesisInput.tsx
│       ├── PlanView.tsx               ← streaming plan renderer
│       ├── NoveltyCard.tsx
│       ├── ProtocolSection.tsx
│       ├── MaterialsTable.tsx
│       ├── BudgetView.tsx
│       ├── TimelineGantt.tsx
│       ├── ValidationSection.tsx
│       ├── CitableText.tsx            ← wraps text spans with citation tooltips
│       ├── SourceTooltip.tsx
│       ├── LiteratureGraph.tsx        ← Cytoscape.js or React Flow
│       ├── FeedbackCanvas.tsx         ← overlay for selections + region clicks
│       └── CommentPopover.tsx
│
├── lib/
│   ├── schema.ts                      ← THE source of truth for types
│   ├── catalog.ts                     ← in-memory reagent lookup
│   ├── protocols.ts                   ← in-memory protocol reference lookup
│   ├── citations/
│   │   ├── allowlist.ts               ← URL domain allowlist for source validation
│   │   ├── lookup.ts                  ← maps field_path strings to DOM
│   │   └── validate.ts                ← post-hoc URL/excerpt validation
│   ├── feedback/
│   │   ├── retrieval.ts               ← query Supabase for past corrections
│   │   ├── text-selection.ts          ← Selection API helpers
│   │   └── region-anchor.ts           ← figure region coordinate helpers
│   ├── graph/
│   │   ├── edges.ts                   ← compute edges between papers
│   │   └── scoring.ts                 ← relevance scoring
│   ├── llm/
│   │   ├── generate-plan.ts           ← orchestrates OpenAI plan generation
│   │   ├── novelty-classify.ts        ← QC pipeline
│   │   └── classify-tags.ts           ← gpt-4o-mini for experiment tagging
│   └── supabase.ts                    ← Supabase client singleton
│
├── data/
│   ├── catalog.json                   ← 150 reagent entries, real catalog numbers
│   ├── protocols.json                 ← 30 protocol references
│   └── mock-plan.ts                   ← validated mock for frontend dev
│
├── prompts/
│   ├── plan_generator.md              ← main system prompt (Moiz's territory)
│   ├── novelty_classifier.md          ← QC system prompt
│   └── tag_classifier.md              ← experiment tagging prompt
│
└── scripts/
    ├── contract-check.ts              ← validates deployed endpoints against schema
    ├── catalog-validator.ts           ← validates catalog.json entries
    └── seed-feedback.ts               ← optional: seed Supabase with demo feedback
```

**Ownership map:**

| Owner | Owns |
|---|---|
| AI Lead (Moiz) | `prompts/`, `lib/llm/`, `lib/citations/validate.ts` |
| Backend Lead | `app/api/`, `lib/feedback/`, `lib/graph/`, `lib/supabase.ts`, `scripts/` |
| Frontend Lead | `app/page.tsx`, `app/components/`, `app/layout.tsx`, styling |
| Data Engineer | `data/`, `lib/catalog.ts`, `lib/protocols.ts`, `lib/citations/allowlist.ts` |

`lib/schema.ts` is shared. Any changes go through team consensus during Sunday morning sync.

---

## 11. System prompt rules

The plan generator system prompt is the contract between us and the model. Locked at the hub. Lives in `prompts/plan_generator.md`. Owned by AI Lead.

Critical rules the prompt must enforce:

**Rule 1: Cite or admit.** Every factual claim must either reference a source from the provided context (catalog, protocol references, QC sources) or set `inferred: true` with a rationale. The model is told that inferred claims are encouraged when honest, and fabricated citations are forbidden.

**Rule 2: Use only catalog reagents.** Materials must be drawn from the provided catalog subset. The supplier enum strictly constrains supplier names. Inventing a reagent that's not in the catalog is forbidden.

**Rule 3: Use only retrieved protocol references.** Protocol citations come from the protocol references provided in context. Inventing a protocols.io DOI is forbidden.

**Rule 4: Generate consistent IDs.** Material IDs (`MAT-001`, `MAT-002`) must be sequential and unique within the plan. References to materials in `materials_used` and `material_ids` must point to existing IDs. Source citation IDs (`SRC-001`, etc.) follow the same pattern.

**Rule 5: Excerpts are verbatim.** The `excerpt` field in each `SourceCitation` must be a direct quote from the source. Paraphrasing the excerpt is forbidden.

**Rule 6: Numbers must be defensible.** Budget line items, total costs, durations, lead times. The model is told that scientists will verify these numbers and unrealistic values cost trust.

**Rule 7: Controls are required for any wet lab experiment.** Computational and theoretical experiments may have an empty controls array, but in vitro/in vivo experiments must include at least positive and negative controls.

**Rule 8: Statistical approach must be specific.** No "standard statistical analysis" or "appropriate tests." Name the test, state the alpha, justify the n.

**Server-side validators that enforce these rules:**

- URL allowlist: `lib/citations/allowlist.ts` checks every `SourceCitation.url` against a list of trusted domains. Failures reject the response.
- Excerpt validator (stretch): `lib/citations/validate.ts` re-fetches a source URL and checks that `excerpt` appears in the page content. Async, runs after response.
- Schema validation: Zod's `.parse()` runs on every response from OpenAI before returning to client. Any structural drift triggers re-generation.

---

## 12. Pre-hub checklist

Items that must be done before anyone leaves the hub at 19:30. Without these, async overnight work blocks itself.

### 12.1 Architecture and contract

- [ ] Project name locked
- [ ] GitHub repo created, all 4 team members have push access
- [ ] Vercel project deployed, URL works (shows blank Next.js)
- [ ] `lib/schema.ts` committed with all schemas from Section 5
- [ ] `data/mock-plan.ts` committed and validates at module load
- [ ] `.env.example` committed with all variable names

### 12.2 Stub endpoints

- [ ] `app/api/qc/route.ts` returns valid `NoveltyCheck` + `SourceCitation[]` from mock data
- [ ] `app/api/plan/route.ts` returns valid `ExperimentPlan` from `MOCK_PLAN`
- [ ] `app/api/literature/graph/route.ts` returns a hardcoded valid `LiteratureGraph`
- [ ] `app/api/feedback/route.ts` accepts and validates against `FeedbackSchema`
- [ ] `app/api/health/route.ts` returns env var status

### 12.3 Credentials and secrets

- [ ] OpenAI API credits form submitted (deadline 20:45)
- [ ] Tavily API credits form submitted
- [ ] Supabase project created, anon key + service key shared via vault
- [ ] All keys in 1Password / Bitwarden vault accessible to team
- [ ] Vercel env vars set: `OPENAI_API_KEY`, `TAVILY_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

### 12.4 Validation tooling

- [ ] `scripts/contract-check.ts` committed and tested against the deployed mock URL
- [ ] `scripts/catalog-validator.ts` committed (will be used by data engineer to verify their catalog)

### 12.5 Coordination

- [ ] Discord/Slack channel set up with deployed URL, repo URL, and link to this DESIGN.md
- [ ] Each team member confirmed their role and reviewed their async work kit
- [ ] Sunday morning meet-up location and time confirmed
- [ ] Backup plan if anyone is sick or late

If any of these items is missing at 19:30, **the team stays at the hub** until they're done. Going home with broken foundations costs more time than the extra hour at the venue.

---

## 13. Sunday morning integration plan

Meet 09:00 CEST. Six hours to integrate, polish, record, and submit.

### 13.1 Sync (09:00 — 09:30)

Each person, 3 minutes:
- What's done
- What's broken
- What's blocked

Designate one integration owner (default: AI Lead). Make a real-time blocker list. Decide: on track, behind (drop stretch goal), or way behind (drop streaming + feedback canvas, ship core only).

### 13.2 Integration (09:30 — 11:30)

Integration owner merges branches in this order:
1. `feat/data` (catalog + protocols) → main
2. `feat/plan-generator` (system prompts + LLM orchestration) → main
3. `feat/api` (real endpoints replacing stubs) → main
4. `feat/ui` (frontend wired to real backend) → main
5. `feat/literature-graph` if exists → main
6. `feat/feedback-canvas` if exists → main

After each merge, run `npx tsx scripts/contract-check.ts` against the deployed URL. If it fails, fix before continuing.

### 13.3 Stretch goal sprint (11:30 — 12:30, optional)

If on track:
- AI Lead: feedback retrieval in `/api/plan` reads from Supabase
- Backend Lead: seed 2-3 demo feedback entries via `scripts/seed-feedback.ts`
- Frontend Lead: feedback canvas saves to `/api/feedback`

Demo path: scientist edits a section, saves, submits a similar hypothesis, new plan reflects the edit.

If at 12:00 the stretch goal isn't working, abandon it. Don't sink the ship for a bonus.

### 13.4 Demo video shoot (12:30 — 13:30)

- Record against deployed URL, not localhost
- 2-4 takes, 90 seconds max
- Voiceover separately, then synced
- Subtitles in English
- Upload to YouTube unlisted or Vimeo
- Test the link in incognito mode

### 13.5 Submission (13:30 — 14:15)

- Devpost: name, tagline, description (200 words), video link, GitHub link, deployed URL, team list
- Track: Corporate Track (Fulcrum) if listed, else Venture Track
- Screenshot every page of the submission
- Push final commit, tag `v1.0-submitted`, never push again

### 13.6 Buffer + rehearsal (14:15 — 15:00)

- Live pitch run-through, twice
- Each person practices their beat
- Charge laptops, identify the demo machine
- Eat. Hydrate.

### 13.7 Submission cutoff: 15:00 CEST

Hands off keyboards.

### 13.8 If selected for top 16 (20:00 — 21:30)

- Connect to venue Wi-Fi 30 minutes early
- Hit deployed URL twice to warm Vercel
- Have the demo video on a local laptop as backup if Wi-Fi fails

---

## Appendix: post-hackathon outreach

Win or lose, on Sunday night or Monday morning, the Product Lead sends this email:

> Subject: AI Scientist demo from Hack-Nation 5
>
> Arun, Jonas,
>
> We built [project name] for your challenge at Hack-Nation this weekend.
>
> Demo: [URL]
> Code: [GitHub]
> Video: [YouTube]
>
> The plan generator uses a curated supplier catalog so output cites real catalog numbers and EUR prices. Literature QC uses Tavily over protocols.io and arXiv. Every claim in the plan has a verifiable citation, with model-inferred claims explicitly marked. We added a feedback loop where scientist corrections inject as few-shot examples into future plans.
>
> Would love your read on whether this hits the bar. Happy to walk through it.
>
> [Team names]

The Fulcrum Fellowship places AI engineers in research labs. That's an actual job pipeline, parallel to the Devpost prize. The email above is the move.

---

**End of DESIGN.md. This is the source of truth. Locked at 19:30. Schema changes overnight require team consensus. Good luck. Ship it.**
