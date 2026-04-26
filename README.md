# Dexter's Laboratory — AI Experiment Planner

Turn any scientific hypothesis into a fully scoped, costed, and validated experiment plan in under a minute.

---

## What it does

You type a hypothesis. Dexter:

1. Searches a local corpus of 2 000+ scraped scientific papers and protocols, supplemented by live Tavily / PubMed results
2. Runs a novelty check — is this already done, partially done, or genuinely new?
3. Calls GPT-4o with structured output (Zod schema) to generate a complete experiment plan: summary, protocol steps, materials list, budget breakdown, timeline, validation criteria, and risk register
4. Renders a live force-directed knowledge graph showing papers, concept clusters, protocol methods, and validation outcomes — all cross-linked by shared tags and thematic overlap
5. Presents the full plan as an interactive report you can highlight, annotate, and export as PDF

---

## Architecture

```
dexter-front/          — TanStack Start (Vite/React) — port 8080
  src/
    routes/index.tsx   — all screens and D3 force graph
    lib/
      api.ts           — fetches backend, transforms ExperimentPlan → DexterPlan
      dexter-store.ts  — Zustand global state
      mock-plan.ts     — types + sample data for offline use

ai-scientist/          — Next.js 15 API-only server — port 3000
  app/api/plan/        — POST /api/plan  (CORS-enabled)
  lib/
    llm/generate-plan.ts  — GPT-4o structured generation + local paper enrichment
    schema.ts             — Zod schema (ExperimentPlan)
    tavily.ts             — Tavily search wrapper
    catalog.ts            — reagent catalog context builder
  data/
    papers.json        — 2 000+ scraped papers with abstracts, tags, citation counts
    protocols.json     — 500+ lab protocols with DOIs
    catalog.json       — reagent catalog (106 entries, necessity-tagged)
    budget_constants.json — EUR labor / equipment / overhead rates
  scrapers/            — Python scrapers (PubMed, protocols.io, JoVE, …)
```

---

## Quick start

### Prerequisites

- Node.js 20.19+ (or 22.12+)
- npm

### 1. Clone and install

```bash
# Backend
cd ai-scientist
npm install

# Frontend
cd ../dexter-front
npm install
```

### 2. Set environment variables

**`ai-scientist/.env.local`**
```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
FRONTEND_URL=*
```

**`dexter-front/.env.local`**
```
VITE_API_URL=http://localhost:3000
```

### 3. Run

Open two terminals:

```bash
# Terminal 1 — backend API (port 3000)
cd ai-scientist
npm run dev

# Terminal 2 — frontend (port 8080)
cd dexter-front
npm run dev
```

Then open **http://localhost:8080**.

On Windows you can also double-click `start-backend.bat` and `start-frontend.bat` from the root folder.

---

## How a plan is generated

```
User submits hypothesis
        │
        ▼
POST /api/plan  (Next.js)
        │
        ├─ filterRelevantPapers()   — keyword score across papers.json (local, cached)
        ├─ filterRelevantProtocols() — keyword score across protocols.json
        ├─ getCatalogContext()       — top matching reagents from catalog.json
        ├─ searchPapers()            — Tavily web search (supplement if local thin)
        │
        ▼
GPT-4o (gpt-4o-2024-08-06) structured output
  system: BSL-2 rules + EUR budget rates + novelty instructions
  user:   hypothesis + local literature + catalog + protocols
        │
        ▼
buildEnrichedPapers()
  — match GPT citations back to local corpus for real authors/abstracts
  — fill remaining slots with top local papers (up to 20 total)
        │
        ▼
JSON response  { ...ExperimentPlan, enrichedPapers[] }
        │
        ▼
transformToDexterPlan()  (frontend)
  — paper nodes  (up to 20, white)
  — concept nodes (top tags by frequency, teal)
  — method nodes  (protocol step titles, green)
  — outcome nodes (validation metrics, amber)
  — edges: chains + tag-overlap cross-links + concept→paper + method chains
        │
        ▼
D3 force graph  +  plan report  +  PDF export
```

---

## API keys

| Key | Where to get it | Required |
|---|---|---|
| `OPENAI_API_KEY` | platform.openai.com | Yes — falls back to mock plan without it |
| `TAVILY_API_KEY` | app.tavily.com | No — web search is skipped if absent |

Without `OPENAI_API_KEY` the backend returns a hardcoded sample plan (trehalose cryopreservation) so you can still explore the UI.

---

## Scrapers (optional)

The `ai-scientist/scrapers/` folder contains Python scrapers that populate `papers.json` and `protocols.json`. You do not need to run them — the data files are already included.

```bash
cd ai-scientist/scrapers
pip install -r requirements.txt
python run_all.py
```

> `cookies.json` is gitignored — it stores session tokens used by some scrapers and must never be committed.

---

## Graph node types

| Shape | Color | Represents |
|---|---|---|
| Large circle | White | Scientific paper (from local corpus or Tavily) |
| Medium circle | Teal | Concept cluster (shared research tag) |
| Small circle | Green | Protocol method (experiment step) |
| Small circle | Amber | Validation outcome (success metric) |

Edges connect papers that share tags, concepts to their papers, method steps to nearby papers, and outcome nodes to the closest concept or paper.
