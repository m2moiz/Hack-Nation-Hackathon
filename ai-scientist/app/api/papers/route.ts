import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

interface RawPaper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  domain: string[];
  tags: string[];
  meshTerms: string[];
  citationCount: number;
}

function loadPapers(): RawPaper[] {
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'papers.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function searchPapers(hypothesis: string, papers: RawPaper[], limit = 14): RawPaper[] {
  const keywords = hypothesis.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const scored = papers
    .map((p) => {
      let score = 0;
      const titleText = p.title.toLowerCase();
      const abstractText = p.abstract.toLowerCase();
      score += keywords.filter((kw) => titleText.includes(kw)).length * 3;
      score += keywords.filter((kw) => abstractText.includes(kw)).length;
      score += keywords.filter((kw) => p.tags.some((t) => t.includes(kw))).length * 2;
      score += keywords.filter((kw) => p.meshTerms.some((m) => m.toLowerCase().includes(kw))).length * 2;
      return { p, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p }) => p);

  return scored.length >= 4 ? scored : papers.slice(0, limit);
}

function buildEdges(papers: RawPaper[]) {
  const edges: { id: string; source: string; target: string; weight: number }[] = [];
  for (let i = 0; i < papers.length; i++) {
    for (let j = i + 1; j < papers.length; j++) {
      const a = papers[i];
      const b = papers[j];
      const sharedDomains = a.domain.filter((d) => b.domain.includes(d)).length;
      const sharedTags = a.tags.filter((t) => b.tags.includes(t)).length;
      const weight = Math.min(1, (sharedDomains * 0.3 + sharedTags * 0.15));
      if (weight > 0) {
        edges.push({ id: `${a.id}-${b.id}`, source: a.id, target: b.id, weight });
      }
    }
  }
  return edges;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const hypothesis = (body as { hypothesis?: string })?.hypothesis ?? '';
  const allPapers = loadPapers();
  const matched = searchPapers(hypothesis, allPapers);
  const maxCitations = Math.max(...matched.map((p) => p.citationCount), 1);

  const papers = matched.map((p, index) => ({
    id: p.id,
    title: p.title,
    authors: p.authors.slice(0, 3).join(', ') + (p.authors.length > 3 ? ' et al.' : ''),
    year: p.year,
    abstract: p.abstract,
    influence: Math.max(0.1, p.citationCount / maxCitations),
    x: Math.cos((index / matched.length) * Math.PI * 2) * 200,
    y: Math.sin((index / matched.length) * Math.PI * 2) * 200,
  }));

  const edges = buildEdges(matched);

  return NextResponse.json({ papers, edges });
}
