import { readFileSync } from 'fs';
import { join } from 'path';

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  doi: string;
  url: string;
  abstract: string;
  domain: string[];
  experimentType: string;
  tags: string[];
  meshTerms: string[];
  keyFindings: string[];
  citationCount: number;
  source: string;
}

function loadPapers(): Paper[] {
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'papers.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getPapersContext(hypothesis: string): string {
  const papers = loadPapers();
  if (papers.length === 0) return '';

  const keywords = hypothesis.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

  const scored = papers
    .map((p) => {
      const titleText = p.title.toLowerCase();
      const abstractText = p.abstract.toLowerCase();
      const tagsText = p.tags.join(' ').toLowerCase();
      const meshText = p.meshTerms.join(' ').toLowerCase();
      let score = 0;

      score += keywords.filter((kw) => titleText.includes(kw)).length * 3;
      score += keywords.filter((kw) => abstractText.includes(kw)).length;
      score += keywords.filter((kw) => tagsText.includes(kw)).length * 2;
      score += keywords.filter((kw) => meshText.includes(kw)).length * 2;
      score += keywords.filter((kw) => p.domain.some((d) => d.includes(kw))).length * 2;

      return { p, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ p }) => p);

  return scored
    .map((p) => `- ${p.title} (${p.source}, ${p.year}) DOI: ${p.doi} — ${p.abstract.slice(0, 200)}`)
    .join('\n');
}
