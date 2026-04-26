import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MOCK_PLAN } from '@/data/mock-plan';
import { searchPapers } from '@/lib/tavily';
import { getCatalogContext } from '@/lib/catalog';
import { generatePlan } from '@/lib/llm/generate-plan';

const RequestSchema = z.object({
  hypothesis: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'hypothesis is required' }, { status: 400 });
  }

  const { hypothesis } = parsed.data;

  const [tavilyContext, catalogContext] = await Promise.all([
    searchPapers(hypothesis),
    getCatalogContext(hypothesis),
  ]);

  try {
    const plan = await generatePlan(hypothesis, catalogContext, tavilyContext);
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json(MOCK_PLAN);
  }
}
