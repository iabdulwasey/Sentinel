# Architectural Decisions — Bolt Sentinel

A brief log of the load-bearing decisions and why they were made.

### 1. Shared core, three thin surfaces
ARR, B1 (onboarding), and B2 (monitoring) are computationally the same shape: *ingest unstructured input → interpret against a market ruleset → validate/retrieve → produce a governed output with explainability and human-in-the-loop.* Building the market-rule layer, document understanding, governance/audit, and explainability once and serving three workflows is how a serious platform is built — and keeps the product consistent. Presented to users as one platform.

### 2. Market = ruleset file (no code change to add a market)
Rulesets are versioned, Zod-validated TypeScript files under `engine/rules/markets/<CODE>/vN.ts`, auto-discovered by a registry. The engine never references a market by name. Validation uses a declarative rule DSL (operator + field + value) so even complex per-market validations need no engine code. Adding a market = a new ruleset file + one `Market` seed row. Rulesets live in code (not DB blobs) for type safety, review, and git versioning; the DB holds a versioned pointer (`filePath` + `contentHash`) for provenance and the B2 ruleset-update re-flag scenario.

### 3. SQLite locally → Turso (libSQL) in production
The user wants zero-config local dev and a Turso-hosted DB in prod. Turso is libSQL (SQLite-compatible), so `provider = "sqlite"` is unchanged; only the runtime driver swaps (Prisma libSQL adapter when `TURSO_DATABASE_URL` is set). Consequences: no native enums (String + Zod unions), no scalar arrays (Json or relations), money as Int micro-USD. All filterable/aggregatable values are real columns; Json is only for display/provenance payloads.

### 4. Live AI for every operation (no fixtures)
Real Claude calls on every pipeline run; results persist to the DB so they aren't re-run on page loads. Seed creates raw entities + ground-truth documents; pipelines run live when a scenario is opened (with an optional warm step to pre-populate the dashboard). Chosen for authenticity — the live "paste a request and watch it process" moment is the core demo.

### 5. Vercel deployment → re-entrant per-stage pipeline execution
Serverless functions have a bounded duration, so no single invocation runs a whole multi-stage AI pipeline. The runner advances one stage per short invocation, self-scheduling the next with `after()`; completed stages are immutable and persisted, so the chain is re-entrant and a timeout just pauses it. A resume sweeper (Vercel Cron + client-poll detection) continues stalled runs. This also gives natural live per-stage progress.

### 6. Document storage abstraction (no runtime filesystem)
Vercel's filesystem is ephemeral/read-only, so PDFs can't live on disk in prod. A storage driver interface has a local-fs implementation (dev) and a Vercel Blob implementation (prod); `Document.storageRef` is the key (local) or URL (blob). PDFs are generated at seed time (local/CI), never in a Vercel request. Bytes are fetched as base64 to feed Claude's native PDF/image input.

### 7. Multi-tier model routing
Cost discipline mirroring enterprise practice: fast tier (Haiku) for classification/forecast arithmetic, balanced (Sonnet) for structured mapping/scoring/assistant, reasoning (Opus) for legal interpretation, extraction, generation, and self-validation. Routed centrally in `engine/llm/router.ts`; the system prompt + ruleset are prompt-cached and cache-hit ratio is tracked.

### 8. The LLM never touches the database
Planning agents emit a typed query plan; a deterministic executor is the only Prisma caller and tags every row with its PK. Figures are computed in code, so provenance row-ids are real, not hallucinated. This is what makes "click any figure → see its source" trustworthy.

### 9. Compliance-constraint framework as architecture (§7.A)
"How is governance enforced?" must have a structural answer. A typed per-market `compliancePolicy` is enforced by middleware at retrieval/generation/output. Deterministic rules are bright-line and override the explaining agent; every constraint decision is explainable and audited. Specifics are directionally realistic and clearly labelled illustrative — the point is the *mechanism*.

### 10. Accuracy & confidence layer as architecture (§7.B)
"How do you know the AI is right?" must have a visible answer. Synthetic documents are generated from known ground truth, enabling a real eval harness (precision/recall, calibration) plus per-field confidence, confidence-gating into the HITL gates, and an independent figure-vs-source check. Surfaced in an Accuracy view.

### 11. Onboarding (B1) and Monitoring (B2) are distinct flows
They share validation machinery but are different lifecycles with different state machines and screens. B1 is a one-shot decision pipeline; B2 is a continuous loop over the live portfolio (expiry forecasting, drift, re-validation on renewal, proactive re-trigger). Kept separate so neither is a watered-down version of the other.

### 12. Hash-chained immutable audit + human-in-the-loop binding
Every action is appended to a tamper-evident audit log. Nothing binds without a human: the system never submits to an authority, never auto-decides a partner, never auto-suspends. Governance is the only place state binds.

### 13. Latest stack (Next.js 16 / Tailwind v4 / React 19)
Per user preference, use the latest stable stack rather than downgrading for caution. Implications: Turbopack default, all request APIs async (`await params`/`cookies`/`headers`), design tokens in `app/globals.css` via Tailwind v4 `@theme`, `proxy.ts` instead of `middleware.ts`.

### 15. The database is the single source of truth for rules (+ Surface C: Regulation Intake)
Rules were originally authored only as versioned TS files and loaded into an in-memory registry at boot. To let regulations be *uploaded and go live at runtime* (Vercel has no writable FS, so new code files can't be added per-request), every `RegulatoryRuleset` row now carries the full, Zod-validated `MarketRuleset` in a `content` column. The built-in six markets are **seeded into** the DB from their code files (code = seed input only); the runtime resolver `engine/rules/store.ts` reads rules from the DB (async, cached by immutable `code:version`). This made the six `getRuleset` call-sites async.

On top of that, **Surface C — Regulation Intake** turns the "market = ruleset" thesis into a self-extending capability: upload a regulation → `RegulationReaderAgent` (PDF → quotable sections) → `RegulationClassifierAgent` (jurisdiction; new market vs version-update) → `RulesetSynthesisAgent` (a proposed `MarketRuleset`, constrained to the executor's closed source/aggregation/operator vocabulary; anything it can't express is surfaced, never fabricated) → self-validate (deterministic `MarketRulesetSchema` parse + an "executor dry-run" in `engine/rules/validate-sources.ts` + an adversarial `ValidationAgent` pass) → diff vs current → **PENDING_REVIEW**. The proposed ruleset is **quarantined** on a `RulesetImport` row and never reaches the rules table until a human **activates** it (`/api/regulation-intake/[id]/activate`), which creates the market or a new version, bumps the active version, and re-flags affected partners — reusing the B2 mechanic. AI proposes; a compliance officer binds. Same governance invariants (provenance per rule, confidence gating, hash-chained audit, HITL) as every other surface.

### 14. Bolt design tokens (researched)
Confirmed from Bolt's live surfaces: brand green `#34D186`, light green `#BDF4D3`, Inter typeface, 4px button / 8–12px card radii, 4px spacing base, subtle two-tier shadows, whitespace-heavy flat card layouts. Bolt uses Inter (no proprietary web font needed). The lightning-bolt mark is recreated as original SVG (IP guardrail — private demo only). Sources: Wikipedia (Bolt company) brand colors `#34D186`/`#BDF4D3`; bolt.eu (Radix Themes + Inter); careers site UI patterns.
