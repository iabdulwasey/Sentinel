@AGENTS.md

# CLAUDE.md — Bolt Sentinel

> Primary AI-context entry point. Read this first, then `SPEC.md` (authoritative), `AGENTS.md` (the AI stages + Next.js 16 rules), and `docs/ARCHITECTURE.md` (the shared core).

## What this is

**Bolt Sentinel** is an AI-native **Regulatory Operations Platform** for a ride-hailing super-app operating across six markets (Estonia, Poland, Portugal, Romania, Nigeria, South Africa). It is one integrated platform covering three operational surfaces over a shared compliance-intelligence engine:

- **Surface A — Authority Request Response (ARR):** interpret a regulator's request → map it to that market's legal requirements → retrieve the data → produce a compliant, fully-traceable report for human review and submission.
- **Surface B1 — Fleet Partner Onboarding:** validate a partner's document pack against market rules, cross-check across documents, risk-score, and draft a go/no-go decision for a human.
- **Surface B2 — Ongoing Compliance Monitoring:** continuously watch the live partner portfolio for upcoming expiries and emerging drift, re-validate on renewal, and proactively re-trigger human review.
- **Surface C — Regulation Intake:** upload a regulation (PDF/text) → AI reads, classifies the jurisdiction, and proposes a complete, executable market ruleset → a human reviews and activates it. This is how rules stay current: regulations change, you upload the new one, and (after human sign-off) it becomes the live ruleset — creating a new market or a new version and re-flagging affected partners.

Everything runs on **synthetic data across six markets**. The product is branded "Bolt Sentinel" in Bolt's design language for a **private demo only** (see the IP guardrail in `README.md`).

## Tech stack

- **Frontend:** Next.js 16 (App Router) + TypeScript (strict) + Tailwind v4 + shadcn/ui + Recharts + Lucide + TanStack Query.
- **Backend:** Next.js Route Handlers (`runtime = "nodejs"`), Zod-validated, structured error envelopes.
- **DB/ORM:** Prisma. Local dev = SQLite file; production = **Turso (libSQL)** via the Prisma driver adapter. Schema is `provider = "sqlite"` either way.
- **AI:** Anthropic Claude via a single centralized client (`engine/llm/client.ts` — the only file that imports `@anthropic-ai/sdk`). Multi-tier routing: `claude-haiku-4-5-20251001` (fast) / `claude-sonnet-4-6` (balanced) / `claude-opus-4-8` (reasoning).
- **Storage:** `engine/storage/` driver — local filesystem in dev, Vercel Blob in prod.
- **Deploy:** Vercel. No single long-running function — pipelines advance one stage per short invocation (see `AGENTS.md`).

## Directory map

```
app/                      Next.js App Router — (console) screens, (auth) login, api/ route handlers
components/               shared UI (ui/ = shadcn primitives; brand/ = Logo; feature components)
engine/
  llm/                    centralized Claude client, model router, prompt registry, cost ledger
  intake/ rules/ retrieval/ generation/ validation/ risk/ explain/   the AI stages
  compliance/             §7.A constraint framework (residency / PII / lawful-basis / retention)
  accuracy/               §7.B confidence model, gating, ground-truth eval harness
  governance/             hash-chained audit, human-in-the-loop state machine, approval
  pipeline/               Stage/Context types, re-entrant runner, progress
  storage/                local-fs + vercel-blob document drivers
  rules/markets/<CODE>/   the six market rulesets (versioned TS files) + registry
  types/                  shared Zod schemas + TS unions (single source of truth)
lib/                      db factory, auth/session, confidence thresholds, formatters, utils
prisma/                   schema.prisma, seed.ts, synthetic-data generators
docs/                     ARCHITECTURE.md, DECISIONS.md
```

## Governance non-negotiables (do not violate)

1. **Human-in-the-loop before anything binds.** The system never auto-submits to an authority, never auto-approves/auto-rejects a partner, never auto-suspends. AI proposes; a human decides. Enforced in `engine/governance/`.
2. **Provenance on every generated figure.** Every number in any output traces to its exact source rows + the prompt version that produced it, and is clickable in the UI.
3. **The LLM never touches the database.** The planner emits a typed query plan; a deterministic executor is the only thing that runs Prisma queries. Figures are computed by code, so provenance is real, not hallucinated.
4. **Audit everything, immutably.** Every meaningful action (human or AI) is appended to a hash-chained audit log with actor, before/after, and — for AI — model, prompt version, cost, and confidence.
5. **AI everywhere it adds value.** Don't replace genuine reasoning steps with deterministic stubs. Use the fast tier for cheap high-volume steps, the reasoning tier for interpretation/generation/risk.
6. **Compliance + accuracy are architectural.** The §7.A compliance-constraint framework and the §7.B accuracy/confidence layer are enforced and visible, not bolted on.
7. **Market = ruleset; the DB is the single source of truth for rules.** Every rule lives in `RegulatoryRuleset.content` (a Zod-validated `MarketRuleset`); the runtime resolver is `engine/rules/store.ts`. The built-in six markets are *seeded into* the DB from `engine/rules/markets/<CODE>/vN.ts` (code = seed input only). Adding/changing a market is a new ruleset version — via seed, or via the **Regulation Intake** surface (upload → AI proposes → human activates) — never a change to engine code.

## How to run

```bash
npm install
cp .env.example .env            # set ANTHROPIC_API_KEY (live AI calls)
npx prisma migrate dev          # create the local SQLite schema
npm run db:seed                 # 6 markets + synthetic data + ground-truth PDFs + §11 scenarios
npm run dev                     # http://localhost:3000
```

Deploy (Vercel + Turso + Blob): set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` + `BLOB_READ_WRITE_TOKEN`, apply the schema to Turso, then seed via `/api/admin/seed` (guarded by `ADMIN_TOKEN`). See `README.md`.

## Pointers

- `SPEC.md` — the authoritative build specification.
- `AGENTS.md` — the 12 AI agents, their contracts, model routing, orchestration, and the Next.js 16 coding rules.
- `docs/ARCHITECTURE.md` — the shared core in depth (pipeline, state machines, provenance, audit, the two critical subsystems).
- `engine/llm/prompts/` — versioned prompt files (e.g. `intake.request.v1.md`).
- `docs/DECISIONS.md` — key architectural decisions and why.
