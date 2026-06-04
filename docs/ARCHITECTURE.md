# Architecture — Bolt Sentinel

Bolt Sentinel is built as a **shared compliance-intelligence core** with three thin surfaces on top. The core is DRY; the surfaces are pipeline configurations of one runner. This document covers the engine modules, the pipeline pattern, the two governance state machines, provenance, audit, the prompt registry, the cost ledger, and the two critical subsystems.

## The core powering three surfaces

```
                         ┌───────────────────────────────────────────────┐
   Surface A (ARR) ──────┤                                               │
   Surface B1 (Onboard) ─┤            SHARED ENGINE CORE                  │
   Surface B2 (Monitor) ─┤                                               │
                         │  intake → rules → retrieval → generation →     │
                         │  validation → risk → explain                   │
                         │                                                │
                         │  cross-cutting middleware:                     │
                         │   • compliance-constraint framework (§7.A)     │
                         │   • accuracy & confidence layer (§7.B)         │
                         │   • governance: audit + HITL + provenance      │
                         │                                                │
                         │  substrate: llm/ (client·router·registry·      │
                         │  ledger) · pipeline/ (runner) · storage/ ·     │
                         │  rules/ (market rulesets) · types/             │
                         └───────────────────────────────────────────────┘
                                          │
                                   Prisma → SQLite (dev) / Turso libSQL (prod)
```

## Engine modules (`engine/`)

| Module | Responsibility |
|---|---|
| `llm/` | Centralized Anthropic client (the only SDK importer), model router (tier policy), prompt registry (versioned files), cost ledger (per-call `AiCallLog`). |
| `intake/` | Unstructured input (text/PDF) → structured `RequestIntent` (ARR) / `DocumentModel` (B1). |
| `rules/` | Market ruleset loader + registry (`markets/<CODE>/vN.ts`), and the LLM rule interpreter → `CompliancePlan`. |
| `retrieval/` | LLM query planner → typed `RetrievalPlan`; deterministic executor over Prisma (the only DB caller in the AI path). |
| `generation/` | Compliant report / decision-narrative generator + provenance capture. |
| `validation/` | Self-check against the checklist + deterministic figure-vs-source verification + per-field confidence. |
| `risk/` | Risk scoring, anomaly detection, expiry forecasting, drift detection — explainable factors. |
| `explain/` | Human-readable rationale generation. |
| `compliance/` | **§7.A** constraint framework: residency, PII, lawful-basis, retention, purpose-limitation. |
| `accuracy/` | **§7.B** confidence model, gating policy, figure verification, ground-truth eval harness. |
| `governance/` | Hash-chained audit log, human-in-the-loop state machine, approval workflow. |
| `pipeline/` | `Stage`/`Context` types, the re-entrant runner, progress emission. |
| `storage/` | Document driver (local-fs dev / Vercel Blob prod). |
| `types/` | Shared Zod schemas + TS unions — the single source of truth for statuses, intents, plans. |

## Pipeline pattern

A surface defines `Pipeline<Ctx> = { surface, stages: Stage<Ctx>[] }`. A `Stage<Ctx>` is `{ name, run(ctx, io) => { ctx, output, confidence?, blocked? }, retryable?, compliancePhase? }`. The runner:

1. Creates a `PipelineRun` (status `QUEUED`) and returns a run id; the HTTP layer responds **202** and schedules stage advancement with `after()`.
2. Runs **one stage per invocation**. Before `retrieval`/`generation`/`output` stages it invokes the §7.A compliance middleware; after stages that emit confidence it invokes the §7.B gate.
3. Persists each stage's status, timing, AI output, and confidence to `PipelineStage` (the live UI reads these).
4. On a `block` (low confidence, unverified figure, validation mismatch, or compliance violation) it transitions the run to `AWAITING_REVIEW` and opens a human-in-the-loop gate; a human decision resumes the runner from that stage.
5. On completion, records `elapsedMs` for the time-saved contrast.

**Why one stage per invocation:** Vercel functions have a bounded duration. Completed stages are immutable and persisted, so the chain is re-entrant — a timeout merely pauses it, and a resume sweeper (Vercel Cron + client-poll detection) continues from the first non-done stage.

## The two governance state machines

- **ARR / B1:** `RECEIVED → PROCESSING → PENDING_REVIEW → (APPROVED | REJECTED | NEEDS_CLARIFICATION) → DONE`.
- **B2:** `COMPLIANT → (EXPIRING_SOON | DRIFT_DETECTED) → PENDING_REVIEW → (REMEDIATED | CONDITIONS_APPLIED | SUSPENDED_RECOMMENDED) → COMPLIANT`.

No binding/submitted/suspended state is ever reached without a human action. Transitions go through a typed helper so an illegal status string can't be written.

## Provenance (first-class)

The deterministic executor returns every record tagged with its primary key and the query that fetched it. The GenerationAgent must cite only those row ids (Structured Outputs + a deterministic post-check rejects any uncited id). Each figure carries `{ sourceRowIds, retrievalQueryId, rulesetRuleId, promptVersion, modelUsed, confidence, verified }` and is persisted as a normalized `ReportField`. The §7.B layer recomputes the figure from the cited rows to set `verified`. The UI renders each figure as a click-through to its source rows + the AI call that produced it.

## Audit (immutable, hash-chained)

Every meaningful action — AI call, constraint decision, gate open/close, human decision, state change — is appended to `AuditLog` with `{ actor, action, entity, before, after, ts }` and, for AI rows, `{ model, promptVersion, costMicroUsd, confidence }`. Rows are hash-chained (`hash = sha256(prevHash + payload)`) so tampering is detectable. Surfaced in the Audit view.

## Prompt registry

Prompts are versioned markdown files under `engine/llm/prompts/` (e.g. `intake.request.v1.md`) with front-matter (`id`, `version`, `tier_hint`, `output_schema`, `cache`). The loader defaults to the highest version (pinnable per env). The version string flows into every result, ledger row, and figure — so any artifact is traceable to the exact prompt that produced it. New prompt versions are regression-gated by the §7.B eval harness (must not regress F1 / calibration).

## Cost ledger

Every Claude call logs `{ stage, model, promptVersion, tokensIn, tokensOut, cacheRead, cacheWrite, latencyMs, costMicroUsd, confidence }` to `AiCallLog`. Cost comes from a per-model rate card including the cache-read discount. The dashboard and audit views aggregate cost per request/partner/market/agent and the cache-hit ratio via SQL. Shown alongside cumulative time-saved as the capital-efficiency story.

## §7.A — Compliance-Constraint Framework

Middleware, not a stage. Invoked at three phases:
- **retrieval** — `detectOverreach(plan, intent, policy)` + `checkResidency(dataClasses, from, to, policy)` *before any byte moves*. A hard block strips the query or halts to review.
- **generation** — `classifyAndMinimize(record, policy)` masks/aggregates data *before* it reaches the model (defense in depth).
- **output** — a final residency/PII sweep over the produced artifact.

Each market ruleset carries a typed `compliancePolicy` (privacy regime, residency rules, PII classification, lawful bases, purpose limitation, retention). Deterministic check functions enforce bright-line rules; the `ComplianceConstraintAgent` reasons about and explains ambiguous cases but **cannot override a hard block**. Every `ConstraintDecision` (`allow | mask | aggregate | omit | block`) is explainable and audited. This drives the Lagos NDPA residency scenario and the Johannesburg POPIA lawful-basis-overreach scenario.

## §7.B — Accuracy & Confidence Layer

- **Per-field confidence** = a calibrated blend of the model's self-reported confidence and deterministic cross-checks (two-pass agreement, format/regex/checksum match, figure-vs-source exact match). Missing/invalid provenance is a hard penalty.
- **Gating** (`lib/confidence.ts`): `≥0.85` pass, `0.6–0.85` flag for review, `<0.6` / unverified / mismatch → block to human. Thresholds are higher for sensitive/financial fields.
- **Figure-vs-source verification** recomputes each figure from its cited rows, independent of the LLM — the hard backstop against hallucinated numbers.
- **Ground-truth eval harness:** synthetic documents are generated *from* known ground-truth data, so the system measures extraction precision/recall/F1, validation catch-rate / false-block-rate, and calibration (Brier/ECE reliability curve), keyed by prompt version + market. Surfaced in the Accuracy view.

## Conversational assistant

The AssistantAgent answers via **tool-use over the same deterministic executor** (not raw embeddings), so it inherits the §7.A compliance gates and produces citable, grounded answers spanning both surfaces. Responses stream with citation chips; ungrounded questions get a visible "no grounded source" caveat rather than a hallucination.
