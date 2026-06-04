<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Next.js 16 coding rules (this project)

Verified against the bundled docs. Follow these exactly:

- **Turbopack is the default** for `next dev` and `next build`. No `--turbopack` flag. Do not add a custom `webpack` config (it makes the Turbopack build fail).
- **All request-time APIs are async** — there is no synchronous fallback anymore. Always `await`:
  - `cookies()`, `headers()`, `draftMode()` (from `next/headers`).
  - `params` and `searchParams` in `page.tsx`/`layout.tsx`.
  - `params` in route handlers, via the context arg: `export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { const { id } = await ctx.params }`.
- **API routes that read the DB or session must be dynamic + Node runtime.** Add `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"` to such route handlers. (Prisma, the Anthropic SDK, and pdfkit all need the Node runtime — never Edge.)
- **Long work uses `after()`** (`import { after } from "next/server"`) — schedule background pipeline-stage advancement after the 202 response. Each invocation advances ONE stage (Vercel function-duration safety); see the pipeline runner.
- **Auth middleware uses the `proxy` convention** (file `proxy.ts`), not `middleware.ts`.
- Generated route types are available via `npx next typegen` (`PageProps<'/route'>`, `LayoutProps<'/route'>`, `RouteContext<'/route'>`).

---

# AGENTS.md — the AI agents of Bolt Sentinel

Every value-adding stage is a named **agent** = a typed LLM operation routed to a model tier, backed by a versioned prompt file in `engine/llm/prompts/`. Nothing else imports the Anthropic SDK; all calls go through `engine/llm/client.ts` so cost, prompt version, and confidence are always recorded.

**Model tiers:** `fast` = `claude-haiku-4-5-20251001`, `balanced` = `claude-sonnet-4-6`, `reasoning` = `claude-opus-4-8`.

**Core invariant:** the LLM never queries the database. Planning agents emit a *typed query plan*; a deterministic executor runs Prisma and tags every row with its primary key. Figures are computed in code, so provenance is real. The model plans and narrates.

## The 12 agents

| Agent | Responsibility | In → Out | Tier | Prompt | Surfaces | Proposes / Enforces |
|---|---|---|---|---|---|---|
| **IntakeAgent** | Parse free text / PDF into structured intent (ARR) or a document model skeleton (B1) | `{text?, docs?}` → `RequestIntent` \| `DocumentModel` | balanced (text), reasoning (docs) | `intake.request.v1`, `intake.document.v1` | A, B1 | proposes |
| **RuleMappingAgent** | Interpret the market ruleset against the intent → which fields are answerable/cautioned/out-of-scope, mandated format, checklist, compliance constraints | `(intent, ruleset, policy)` → `CompliancePlan` | reasoning | `rules.interpret.v1` | A, B1 | proposes |
| **RetrievalPlannerAgent** | Turn the plan into a typed query plan (NO DB access) | `(CompliancePlan, schema)` → `RetrievalPlan` | balanced | `retrieval.plan.v1` | A | proposes |
| **ExtractionAgent** | Read documents (native PDF/image) → typed fields + provenance + per-field confidence; flag gaps/illegible regions | `(docs, expectedFields)` → `ExtractionResult` | reasoning | `extraction.fields.v1` | B1, B2 | proposes |
| **GenerationAgent** | Generate the compliant report / onboarding-decision narrative with per-figure provenance | `(dataset, plan)` → `GeneratedReport` \| `DecisionNarrative` | reasoning | `generation.report.v1`, `generation.onboarding.v1` | A, B1 | proposes |
| **ValidationAgent** | Self-check the output against the compliance checklist; flag mismatches (blocks completion) | `(output, plan, dataset)` → `ValidationOutcome` | reasoning (adversarial prompt, distinct from generator) | `validation.selfcheck.v1` | A, B1, B2 | proposes (blocks) |
| **RiskAgent** | Explainable partner risk score with contributing factors | `(extraction \| dataset, riskModel)` → `RiskAssessment` | balanced | `risk.score.v1` | B1, B2 | proposes |
| **ExpiryForecastAgent** | Forecast upcoming credential/license expiries into proactive compliance-gap predictions | `(documents, anchor)` → `ExpiryForecast` | fast | `risk.forecast.v1` | B2 | proposes |
| **DriftDetectionAgent** | Compare prior snapshot vs fresh state → material compliance drift | `(prev, fresh)` → `DriftReport` | balanced | `risk.drift.v1` | B2 | proposes (alerts) |
| **ComplianceConstraintAgent** | Reason about residency / PII / lawful-basis / purpose for ambiguous cases; explain constraint decisions | `(dataClasses, policy, phase)` → `ConstraintDecision[]` | reasoning | `compliance.constraint.v1` | middleware (A, B1, B2) | enforces (deterministic rules override the agent) |
| **ExplainAgent** | Human-readable rationale for a field/decision | `(item, factors)` → `Explanation` | balanced | `explain.rationale.v1` | A, B1 | proposes |
| **AssistantAgent** | Grounded conversational Q&A across both surfaces with citations | `(question, scope)` → `GroundedAnswer` | balanced ↑ reasoning | `assistant.grounded.v1` | global | proposes |
| **RegulationReaderAgent** | Read an uploaded regulation (native PDF/image) → quotable sections + detected jurisdiction/language | `(docs)` → `RegulationReading` | reasoning | `regulation.read.v1` | C | proposes |
| **RegulationClassifierAgent** | Classify jurisdiction/regulator/regime; decide new-market vs version-update against existing markets | `(reading, markets)` → `RegulationClassification` | balanced | `regulation.classify.v1` | C | proposes |
| **RulesetSynthesisAgent** | Synthesize a complete, executable `MarketRuleset` (constrained to the closed source/operator vocab) + per-rule provenance + honest gaps | `(reading, classification, prior?)` → `RulesetSynthesisOutput` | reasoning | `ruleset.synthesize.v1` | C | proposes (quarantined draft) |

(ValidationAgent is reused on Surface C with `ruleset.validate.v1` — an adversarial review of the synthesized draft.)

## Orchestration

A **surface** is a pipeline = an ordered list of typed stages `(ctx) => ctx`. Stages call agents. The runner (`engine/pipeline/runner.ts`) persists each stage's status, timing, output, and confidence so the UI renders live progress.

- **ARR pipeline:** intake → rule-mapping → retrieval-plan → retrieval-exec → generation → self-validation → explain → finalize.
- **B1 pipeline:** document-intake → extraction → rule-mapping → retrieval-exec → risk → decision-generation → self-validation → explain → finalize.
- **B2 loop:** refresh-extraction → drift → expiry-forecast → risk → self-validation → monitor-emit. Reuses B1's extraction + validation stages.
- **REGINTAKE pipeline (Surface C):** read → classify → synthesize → self-validate (deterministic `MarketRulesetSchema` parse + executor dry-run + adversarial review) → diff → finalize(→ PENDING_REVIEW). The proposed ruleset is quarantined on a `RulesetImport` row; a human activates it via `/api/regulation-intake/{id}/activate`, which writes the validated `content` to the rules table, bumps the active version, and re-flags affected partners. The DB is the single source of truth for all rules (`engine/rules/store.ts`).

**Vercel-safe execution:** `POST /api/pipelines/{surface}` creates the run, returns **202 + runId**, and `after()` advances the first stage. Each stage, on completion, persists its output and schedules the next via `after()`. Completed stages are immutable, so a function timeout just pauses the chain; a resume sweeper (Vercel Cron + client-poll detection) continues from the first non-done stage. The client `PipelineStepper` polls `GET /api/pipelines/{id}/status`.

## Model-routing policy (rationale)

- **reasoning** for legal interpretation (RuleMapping, ComplianceConstraint), document extraction (errors poison everything downstream), generation (format/constraint adherence), and self-validation (must be at least as capable as the generator — run with an adversarial prompt and/or a different tier to avoid shared blind spots).
- **balanced** for structured mapping (RetrievalPlanner), scoring/drift (Risk, Drift), rationale (Explain), and the Assistant (escalates to reasoning for multi-hop questions).
- **fast** for date-arithmetic-heavy forecasting and simple classification.
- Prompt-cache the system prompt + ruleset; track cache-hit ratio in the cost ledger.

## Human-in-the-loop checkpoints

Every agent **proposes**; binding happens only at a human gate (`engine/governance/`):
- **ARR:** human approves before any export is produced for submission. The system never submits to the authority.
- **B1:** human chooses approve / approve-with-conditions / reject. The system never auto-decides.
- **B2:** human chooses remediate / apply-conditions / recommend-suspension. The system never auto-suspends.

## Confidence-gating policy (where low confidence forces review)

Defined once in `lib/confidence.ts` and enforced by `engine/accuracy/`:
- `≥ 0.85` (higher for sensitive/financial fields) → pass.
- `0.6–0.85` → completes but flagged for mandatory human attention.
- `< 0.6`, OR a figure that fails figure-vs-source verification, OR a validation mismatch → **blocks** the pipeline and opens a human-in-the-loop gate.
