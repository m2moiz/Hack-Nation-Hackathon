# Dexter's Laboratory — AI Experiment Plan Generator

> From hypothesis to runnable experiment plan in seconds.

Dexter turns a scientific hypothesis into a complete, sourceable experiment protocol with budget, timeline, literature graph, and validation criteria — powered by GPT-4o and a curated database of 1,253 real scientific papers.

---

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  dexter-plan-forge          │        │  ai-scientist-backend        │
│  React + Vite + TanStack    │──────▶ │  Next.js + GPT-4o            │
│  Hosted on Vercel           │  API   │  Hosted on Vercel            │
└─────────────────────────────┘        └──────────────────────────────┘
```

---

## Features

- **Hypothesis input** — plain-language scientific hypothesis
- **Literature graph** — interactive force-directed graph of 1,253 real papers matched to the hypothesis
- **AI plan generation** — GPT-4o generates a complete experiment plan including:
  - Novelty assessment (novel / similar exists / exact match)
  - Step-by-step protocol with real protocol references
  - Itemised budget in EUR with real reagent catalog numbers
  - Timeline with phases and deliverables
  - Risk assessment with mitigations
- **PDF export** — download the full report
- **Annotation canvas** — highlight and annotate any part of the plan

---

## Repos

| Part | Repo | Hosting |
|---|---|---|
| Frontend | [m2moiz/dexter-plan-forge](https://github.com/m2moiz/dexter-plan-forge) | Vercel |
| Backend | [Woupa/ai-scientist-backend](https://github.com/Woupa/ai-scientist-backend) | Vercel |

---

## Backend — `ai-scientist`

### Stack
- **Next.js 16** — API routes
- **OpenAI GPT-4o** — structured plan generation
- **Zod** — strict schema validation

### Data (no external APIs needed)
- `data/papers.json` — 1,253 real scientific papers
- `data/catalog.json` — 90 real reagents with catalog numbers and prices
- `data/protocols.json` — curated reference protocols
- `data/budget_constants.json` — real labor and equipment rates (EUR)

### API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/plan` | POST | Generate a full experiment plan from a hypothesis |
| `/api/papers` | POST | Return relevant papers for the literature graph |

### Local setup

```bash
cd ai-scientist
npm install
cp .env.example .env   # add your OPENAI_API_KEY
npm run dev            # runs on http://localhost:3000
```

### Environment variables

```
OPENAI_API_KEY=sk-...
```

### Deployment (Vercel)

```bash
npm i -g vercel
vercel
```

Set `OPENAI_API_KEY` in Vercel → Settings → Environment Variables.

---

## Frontend — `dexter-plan-forge`

### Stack
- **React 19 + Vite** — UI
- **TanStack Router** — routing
- **Zustand** — state management
- **shadcn/ui** — components
- **d3-force** — literature graph physics

### Local setup

```bash
cd dexter-plan-forge
npm install
npm run dev            # runs on http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:3000` automatically.

### Environment variables (production)

```
VITE_API_URL=https://ai-scientist-backend.vercel.app
```

Set this in **Vercel → Settings → Environment Variables**.

---

## How it works

```
1. User enters hypothesis
       ↓
2. POST /api/papers → returns 14 relevant papers from papers.json
   (scored by keyword match on title, abstract, tags, MeSH terms)
       ↓
3. User explores the literature graph
       ↓
4. POST /api/plan → GPT-4o receives:
   - hypothesis
   - matched papers (abstracts + DOIs)
   - relevant reagents from catalog.json
   - reference protocols from protocols.json
   - budget rates from budget_constants.json
       ↓
5. GPT-4o returns structured JSON plan (validated by Zod)
       ↓
6. Frontend displays full plan with PDF export
```

If OpenAI fails or no API key is set → falls back to mock plan automatically.

---

## Team

Built at Hack-Nation 5 — Fulcrum Track.
