# Dexter — Hack-Nation Global AI Hackathon (5th ed.), Fulcrum Science Track

**Event:** Hack-Nation — Global AI Hackathon, **5th edition** · **online + ~13 global hubs** · **April 25–26, 2026** (24h sprint)
**What I built:** Dexter ("Dexter's Laboratory" / AI co-scientist) — turns a one-sentence scientific hypothesis into a fact-checkable, fully-costed, runnable **experiment plan in ~90 seconds**. Searches a local corpus of 2,000+ scraped papers/protocols + live Tavily search.
**Team:** 3 people — _TODO names_
**Result:** _TODO confirm — see the "possible 3rd place" note below_
**Live demo:** https://dexters-laboratory.mmmiscellaneous.workers.dev
**API:** https://ai-scientist-ruddy.vercel.app/api/plan _(note: the Vercel `ai-scientist` deploy was taken down 2026-06-29, so this API link may now be dead)_

## Repos / structure
Two sub-repos (each its own `.git`):
- `ai-scientist-backend/` → `m2moiz/Hack-Nation-Hackathon` (backend, LLM orchestration)
- `dexter-plan-forge/` → `m2moiz/dexter-plan-forge` (frontend — Cloudflare Workers / Vite; d3-force graph)

## Public event facts (researched 2026-06-29, sourced)
- **Organizer:** **Hack-Nation**, a nonprofit "rooted in the MIT ecosystem" (an MIT alumni jury ran; it is *not* an official MIT-department event). hack-nation.ai
- **Format:** primarily **online** + ~13 in-person hubs (SF, Stanford, MIT/Cambridge, NYC, London, Paris, Munich, Zurich, Dresden, Linz, Delhi, Yerevan, GIKI). Participants from **60+ countries.**
- **What "Fulcrum" is:** **Fulcrum Science** (fulcrum.science, led by Adam Jonas) — a public-good initiative to accelerate scientific research; it was a **track/challenge sponsor**, not the organizer.
- **The Fulcrum challenge:** *"The AI Scientist: from hypothesis to runnable experiment plan"* — exactly what Dexter does.
- **Sponsors:** OpenAI, Databricks, Supabase, Vercel, Lovable, ElevenLabs, Hudson River Trading, DSV-Gruppe, Spiral, **Fulcrum Science**, Mozilla, Cursor, GitHub, World Bank Youth Summit.
- **Prizes:** ~**$30,000–$35,000+** cash/benefits + ~**$150–160k in API credits** (incl. $25k OpenAI credits).
- **Sources:** https://hack-nation.ai/ · https://hack-nation.devpost.com/ ("5th Global AI Hackathon") · https://fulcrum.science/.

## ⚠️ Possible 3rd-place result — verify
A LinkedIn-sourced report (which the researcher could **not** open directly, so **unverified**) describes a project called **"HypoForge"** placing **3rd in the Fulcrum Science Challenge** (a NUST-SEECS team). HypoForge's description — "plain-English hypothesis → structured experiment briefing with literature novelty check, protocol, reagents + supplier catalog numbers, budget, validation, scored across 5 dimensions" — **matches Dexter almost exactly.** If HypoForge was your team's project (or its hackathon-day name), that's your **3rd place** — please confirm. Do not treat as fact until you verify.

## Notes
- `api-keys.md` is a loose local file in this wrapper — **verified NOT in any git repo and never pushed** (safe), but consider deleting/rotating the keys.
- _TODO (yours):_ teammate names, confirm placement (HypoForge?), event hub you competed from.
