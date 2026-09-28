# Bolt Sentinel

**An AI-native Regulatory Operations Platform for ride-hailing.** One integrated platform that automates two of the highest-effort manual compliance challenges across six markets (Estonia, Poland, Portugal, Romania, Nigeria, South Africa):

- **Authority Request Response** — a regulator asks for something; Sentinel interprets the request, maps it to that market's legal requirements, retrieves the data, and produces a compliant, fully-traceable report for human review and submission.
- **Fleet Partner Compliance** — two distinct lifecycles: **Onboarding** (validate a partner's documents against market rules, cross-check, risk-score, draft a decision) and **Ongoing Monitoring** (track expiries and drift across the live portfolio, re-validate on renewal, proactively re-trigger review).

Every value-adding stage is AI-driven (Anthropic Claude). Every output is governed: per-field provenance, immutable hash-chained audit, confidence on every figure, and **human-in-the-loop before anything binds**. Two subsystems make governance architectural: a **Compliance-Constraint Framework** (data residency / PII / lawful-basis / retention, enforced and explainable) and an **Accuracy & Confidence Layer** (per-field confidence, gating, figure-vs-source verification, and a ground-truth eval harness over the synthetic corpus).

## Screenshots

_(placeholder — add screenshots of the Home dashboard, an ARR request workspace with the live pipeline stepper, a B1 onboarding workspace with the document viewer, and the B2 monitoring dashboard.)_

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind v4 · shadcn/ui · Recharts · TanStack Query · Prisma · SQLite (dev) / **Turso libSQL** (prod) · **Anthropic Claude** (Haiku / Sonnet / Opus tiers, native PDF/image, Structured Outputs) · Vercel Blob (document storage) · deployable on **Vercel**.

## Quickstart

```bash
npm install
cp .env.example .env            # set ANTHROPIC_API_KEY
npx prisma migrate dev          # local SQLite schema
npm run db:seed                 # 6 markets + synthetic data + ground-truth PDFs + demo scenarios
npm run dev                     # http://localhost:3000
```

Sign in with a seeded reviewer account (printed by the seed script), then open the **Authority Requests** inbox and run the Tallinn scenario to watch the live AI pipeline.

## Deploy (Vercel + Turso + Blob)

1. Create a Turso database and a Vercel Blob store.
2. Set env vars in Vercel: `ANTHROPIC_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `SESSION_SECRET`, `ADMIN_TOKEN`, `CRON_SECRET`, `SEED_ANCHOR`.
3. Apply the Prisma schema to Turso, deploy, then seed via `POST /api/admin/seed` with the `ADMIN_TOKEN`.

The `vercel.json` crons run the B2 monitoring sweep and a stalled-pipeline resume sweeper; both are also triggerable manually in-app.

## Docs

- [`SPEC.md`](./SPEC.md) — the authoritative build specification.
- [`CLAUDE.md`](./CLAUDE.md) — product + stack + directory map + governance non-negotiables.
- [`AGENTS.md`](./AGENTS.md) — the 12 AI agents + Next.js 16 coding rules.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — the shared core in depth.
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — key architectural decisions and why.

_All data in this project is synthetic. Regulatory details are directionally realistic but illustrative, not legal advice._
