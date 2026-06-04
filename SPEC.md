# SENTINEL — Regulatory Operations Platform
## Master Build Specification (SPEC.md)

> **For Claude Code.** This is the authoritative build document. Read it fully before writing any code. Build to enterprise production grade. Every layer must actually work end-to-end on synthetic data. Use AI (LLM reasoning) at every stage where it adds value — this is an AI-native platform, not a CRUD app with one AI feature bolted on. There is **no "demo subset"** — build the full product, flawless.

---

## 0. WHAT WE ARE BUILDING — IN ONE BREATH

Sentinel is an **AI-native Regulatory Operations Platform** for a ride-hailing super-app operating across many countries. It is a single, integrated, production-grade platform that solves **two of the highest-effort manual-compliance challenges** in ride-hailing central operations:

- **Surface A — Authority Request Response (ARR):** A regulator/authority sends a request ("provide all licensed drivers in Zone X for Q1 with license validity and trip counts"). Sentinel interprets it with AI, maps it to that market's legal requirements, pulls the data, and produces a compliant, fully-traceable report for human review and submission.
- **Surface B — Fleet Partner Compliance (FPC):** Covering **two distinct, fully-built lifecycles** — (B1) **Onboarding** a new fleet partner (validate submitted documents against market rules, score risk, decide), and (B2) **Ongoing Compliance Monitoring** of the live partner portfolio (track expiries, re-validate, detect drift, re-trigger review proactively).

Under the hood both surfaces are powered by a shared compliance-intelligence core (good engineering, kept DRY), but the product is presented simply as **one platform for two operational challenges**. Every stage uses AI where it adds value. Every output is governed: explainability on every field, full audit trail, human-in-the-loop before anything binds. Built to look like it belongs inside the operator's own product suite.

**Build target:** Production enterprise-grade, fully working, flawless. Realistic synthetic data across **six markets** (below) spanning EU + Africa.

---

## 1. THE PROBLEM WE ARE SOLVING (FULL CONTEXT)

### 1.1 The operating reality
A ride-hailing platform operating across many countries faces a regulatory surface area that is enormous and **non-uniform**. Every market has its own:
- transport licensing regime (e.g., Portugal's TVDE operator licensing; Poland's taxi stamps and license extracts; Romania's ARR territorial-agency authorization; Estonia's ride-hailing operating-permit regime; Nigeria's state-level ride-hailing permits; South Africa's operating-licence/NLTA regime),
- document requirements for fleet partners and drivers,
- data-residency, privacy, retention, and lawful-basis constraints (GDPR-strict across the EU with national variations; distinct regimes in Nigeria under the NDPA and South Africa under POPIA),
- authority reporting obligations and ad-hoc information requests.

Two operational workflows consume enormous manual effort and are the highest-value automation targets.

### 1.2 Problem A — Authority Request Response
Local operations teams receive **regular, ad-hoc requests from regulatory authorities**. Examples:
- "Provide a list of all drivers who operated in the central zone of Lisbon during Q1 2026, with their license validity status and total completed trips."
- "Submit, under [local decree], evidence that all active vehicles in Warsaw hold valid inspection certificates as of [date]."
- "Report all fleet partners operating in Lagos with their permit numbers and the number of drivers under each."

Today this is **manual and slow**: an ops person must (a) interpret what's actually being asked, (b) know the market-specific legal requirements and acceptable format, (c) figure out which internal systems hold the data, (d) pull and cross-reference that data, (e) assemble a compliant report, (f) get it reviewed. This takes **hours to days per request**, happens **regularly across many markets**, and carries **legal and financial risk** if done wrong or late. The knowledge of "how to answer this authority in this market" lives in local ops staff heads and does not scale.

### 1.3 Problem B — Fleet Partner Compliance
A fleet partner is a company operating multiple vehicles/drivers on the platform. Two distinct lifecycles, both manually heavy:

**B1 — Onboarding.** Collecting and validating a **market-specific set of documents** — operator licenses, commercial insurance, vehicle registrations and inspection certificates, driver certifications, tax/business registration. These vary by market, must be validated for authenticity, completeness, and internal consistency, and a go/no-go decision must be made. Today this is slow manual review with back-and-forth over days, and is often delegated to partners because central review does not scale.

**B2 — Ongoing Compliance Monitoring.** Once onboarded, a partner's compliance is **not static**: documents **expire on rolling schedules**, fleet composition changes, new vehicles are added, regulations update. The platform must continuously monitor the live portfolio, detect upcoming expiries and emerging gaps **before** they create exposure, re-validate when documents are renewed, and re-trigger review when a partner drifts out of compliance. Today lapses go unnoticed until they become incidents.

### 1.4 Why these belong in one platform
Both A and B are, computationally: **ingest unstructured input → interpret against a market-specific regulatory ruleset → validate / retrieve → produce a governed compliant output, with explainability and human-in-the-loop.** The market-rule layer, the document/text understanding, the governance/audit/human-in-the-loop layer, and the explainability + accuracy layer are common infrastructure. Building them once and serving multiple compliance workflows is simply how a serious platform is built. To the user, it is **one integrated regulatory-operations platform** that happens to cover authority requests and fleet compliance — with a clear path to extend to further compliance workflows later.

### 1.5 What "good" looks like
- An authority request that took a local ops person **half a day** is interpreted, populated, and turned into a **review-ready compliant report in seconds**, with every figure traceable to its source and every market-specific requirement explicitly satisfied — and the **time saved shown explicitly**.
- A fleet partner's document pack that took **days of back-and-forth** is **validated in seconds**, with gaps, expiries, authenticity concerns, inconsistencies, and a risk score surfaced, and a clear onboarding decision drafted for human approval.
- The live partner portfolio is **continuously monitored**: expiries and emerging gaps are surfaced **proactively**, before they become incidents.
- Nothing is ever auto-submitted to a regulator or auto-approves/auto-rejects a partner. **Humans decide; AI does the heavy lifting and shows its work, with confidence and accuracy made visible.**

---

## 2. AI-FIRST PRINCIPLE — USE AI EVERYWHERE IT ADDS VALUE

Non-negotiable and central. **Every stage that can be model-driven must be.** Do not build deterministic stubs where an LLM adds genuine value. AI touchpoints by stage:

**Shared engine:**
1. **Intake understanding** — LLM parses unstructured authority requests / documents into structured intent (entities, fields requested, legal basis cited, deadline, market).
2. **Rule interpretation** — LLM reasons over the market-specific ruleset to determine which requirements apply, what format is mandated, what the authority can legally request, what compliance constraints bind (residency, PII, retention, lawful basis).
3. **Retrieval planning** — LLM plans which data sources/fields are needed and constructs the query plan (the agentic planning step).
4. **Document extraction & normalization** — LLM (native PDF + image understanding via Anthropic API) extracts structured data from documents → typed fields, normalizes formats across markets/languages, **flags any gap, missing field, illegible region, or low-confidence extraction** rather than silently passing it.
5. **Generation** — LLM generates the compliant report / onboarding decision narrative, quantifying and formatting per market requirements.
6. **Validation & self-check** — LLM validates its own output against the requirement checklist; every claimed figure is verified against source (value/quote match) before it is allowed into the output.
7. **Risk & anomaly reasoning** — LLM scores partner risk, flags document anomalies, detects cross-document inconsistencies, predicts expiry-driven compliance gaps.
8. **Explainability** — LLM produces a human-readable rationale for every field/decision.
9. **Conversational layer** — an LLM assistant over the whole platform: ops users ask in natural language and get grounded, cited answers spanning both surfaces.

**Model routing (cost discipline — mirror enterprise practice):**
- **Fast model** (Claude Haiku-class) for high-volume cheap steps: classification, extraction, normalization, simple validation.
- **Reasoning model** (Claude Sonnet/Opus-class) for: rule interpretation, retrieval planning, report generation, risk reasoning, conversational layer.
- Track AI cost per operation in a cost ledger (capital-efficiency signal).
- Version all prompts as files (§6.7).

---

## 3. THE SURFACES — DETAILED FUNCTIONAL SPEC

### 3.1 SURFACE A — Authority Request Response (ARR)

**User:** Local operations / compliance staff in a market.

**End-to-end flow:**
1. **Request intake.** User pastes or uploads an incoming authority request (free text, email body, or PDF). System auto-detects the **market** (or user selects). Status `RECEIVED`.
2. **AI understanding.** LLM parses into structured `RequestIntent`: `authority`, `legal_basis`, `market`, `deadline`, `subjects` (drivers/vehicles/fleet partners/trips), `requested_fields`, `filters` (zone, period, status), `ambiguities` (surfaced for human clarification).
3. **AI rule mapping.** LLM consults the **market regulatory ruleset** → `CompliancePlan`: which requested fields are legally answerable / require caution / are out of scope; mandated report format and required fields for this authority/market; **compliance constraints** (residency, PII minimization, retention, lawful basis — see §7); explicit checklist the final report must satisfy.
4. **AI retrieval planning + execution.** LLM constructs a query plan over the operational datastore; system executes deterministically; structured dataset returned.
5. **AI report generation.** LLM generates the compliant report, formatted to the market's mandated structure, every figure populated from retrieved data, with a **per-field provenance map**.
6. **AI self-validation + accuracy.** LLM checks the report against the `CompliancePlan` checklist and verifies every figure against source; attaches **confidence** per field; discrepancies or low confidence block completion and are flagged (see §7 accuracy layer).
7. **Human-in-the-loop review.** Status `PENDING_REVIEW`. Reviewer sees the original request, AI interpretation, the compliance checklist (each item with rationale and confidence), the generated report, full provenance, and the **time-saved contrast** (manual baseline vs actual elapsed). Reviewer edits / regenerates / approves / rejects. **System never submits to the authority** — on approval, status `APPROVED_FOR_SUBMISSION` and an export (PDF/structured) is produced for the human to submit.
8. **Audit.** Every step logged immutably.

**Key screens (A):** Requests inbox (status, market, deadline, SLA countdown); Request workspace (the staged AI pipeline, each stage inspectable, live progress + per-stage timing); Compliance checklist panel (per-item rationale + confidence); Provenance view (click any figure → source rows); Report preview + export; **time-saved contrast** shown on completion.

### 3.2 SURFACE B1 — Fleet Partner Onboarding (FPC-Onboarding)

**User:** Fleet operations / compliance staff.

**End-to-end flow:**
1. **Document intake.** A fleet partner record is created (synthetic). Documents uploaded (synthetic PDFs/images: operator license, insurance, vehicle registrations, inspection certs, driver certs, business registration).
2. **AI document understanding.** LLM (native PDF/image) reads each document → typed fields (issuer, ID number, validity dates, holder, vehicle details), classifies type, **flags any gap / missing field / illegible region / low-confidence field** for review.
3. **AI rule mapping.** LLM consults the market ruleset → **required-document checklist** for that market and partner type, plus validation rules per document.
4. **AI validation + cross-checks.** LLM validates each document against its rules AND cross-checks across documents (name consistency, vehicle count vs registrations, expiry coherence, holder vs business-registration match). Per-document status (valid / expiring / invalid / missing / inconsistent) with rationale + confidence.
5. **AI risk scoring.** Explainable partner **risk score** (completeness, expiry proximity, inconsistencies, market risk factors).
6. **Human-in-the-loop decision.** Status `PENDING_REVIEW`. Reviewer sees every document with extracted fields + validation + confidence, the required-document checklist, cross-check results, the risk score with factors, and a **drafted decision** (approve / approve-with-conditions / reject) with rationale + **time-saved contrast**. Reviewer decides. **System never auto-decides.** Approved partners pass into B2 monitoring.
7. **Audit** throughout.

**Key screens (B1):** Onboarding queue (partners awaiting onboarding, market, completeness); Onboarding workspace (documents, extracted fields, validation, cross-checks, risk, decision draft); Document viewer (original ↔ extracted fields + validation rationale + confidence); Required-document checklist panel; decision + time-saved contrast.

### 3.3 SURFACE B2 — Ongoing Compliance Monitoring (FPC-Monitoring)

**User:** Fleet operations / compliance staff. **Distinct from onboarding — its own flow, screens, and state machine.**

**What it does (continuous lifecycle over the live portfolio):**
1. **Portfolio state.** All onboarded partners with current compliance status, risk score, and per-document validity/expiry tracked over time.
2. **AI expiry forecasting.** System computes upcoming expiries; LLM contextualizes them into proactive compliance-gap predictions ("3 vehicle inspections lapse within 30 days; this partner falls below the market's fleet-compliance threshold on [date]").
3. **AI drift & gap detection.** Detects emerging non-compliance: fleet composition changes, new vehicles without valid docs, regulation updates affecting a market's ruleset, documents approaching or past expiry, partners trending toward risk thresholds.
4. **Re-validation on renewal.** When a renewed document is submitted, the engine re-runs validation (same B1 machinery) and updates status — no full re-onboarding.
5. **Proactive re-trigger + human-in-the-loop.** Partners drifting out of compliance are flagged and routed to review with a recommended action; humans decide on conditions/suspension/remediation. **System never auto-suspends.**
6. **Portfolio compliance health.** Aggregate view: % compliant, at-risk partners, upcoming-expiry pipeline, market-by-market compliance posture.
7. **Audit** throughout.

**Key screens (B2):** Monitoring dashboard (portfolio compliance health, market filter); Expiry pipeline (timeline of upcoming expiries with severity); At-risk partners list (risk trend, reason, recommended action); Partner monitoring detail (compliance history, document timeline, re-validation, re-trigger); proactive alerts.

### 3.4 SHARED — Conversational Assistant & Home Dashboard
- **Home dashboard** — unified operational view across all surfaces: open authority requests (with SLA), onboarding queue, portfolio compliance health, upcoming expiries, recent AI activity, **cumulative time-saved and cost ledger summary**, multi-market filter.
- **Conversational assistant** (global, Cmd-K) — LLM-powered, grounded with citations, spanning all surfaces ("what's due this week across Tallinn and Warsaw?", "which partners are at risk in Lagos?", "why was this partner flagged?", "summarize the open request from the Porto authority").

---

## 4. THE SIX SYNTHETIC MARKETS

Build realistic synthetic regulatory rulesets + operational data for **six genuine Bolt markets**, chosen to span the regulatory range (EU-strict GDPR variants + two distinct African regimes):

1. **Estonia (Tallinn)** — ride-hailing operating-permit regime; EU/GDPR; Bolt's home market. Authority: Transport Administration / Tax & Customs Board interfaces.
2. **Poland (Warsaw)** — taxi license-extract regime, vehicle taxi markings/stamps, license extracts; EU/GDPR. Authority: municipal transport authority.
3. **Portugal (Lisbon/Porto)** — TVDE regime: operator licenses, TVDE driver certificates, vehicle TVDE badges, inspections; EU/GDPR. Authority: IMT / municipal.
4. **Romania (Bucharest)** — ARR territorial-agency authorization regime; EU/GDPR. Authority: ARR / local.
5. **Nigeria (Lagos)** — state-level ride-hailing operator permits, vehicle registration, driver permits; **NDPA** data regime (non-EU). Authority: Lagos State (e.g., LASDRI / state transport).
6. **South Africa (Johannesburg/Cape Town)** — operating-licence regime under NLTA; vehicle roadworthiness/registration, PrDP driver permits; **POPIA** data regime (non-EU). Authority: provincial regulatory entity / NPTR.

For each market provide a **ruleset file** (machine-readable: required documents, validation rules, authority-request answerable fields, mandated report formats, **compliance-constraint policy** per §7) and **synthetic operational data** (drivers, vehicles, fleet partners, trips, documents) with realistic shapes, names localized appropriately, and dates spread to create live expiry/anomaly/ambiguity scenarios.

**Market = ruleset file.** Adding a market requires no code change — only a new ruleset. Make this abstraction clean and explicit.

---

## 5. TECH STACK

Modern, production-grade, consistent. Bias toward what ships cleanly and looks enterprise.

- **Frontend:** Next.js 15 (App Router) + TypeScript (strict) + Tailwind CSS. shadcn/ui primitives. Recharts for charts. Lucide icons. **Design tokens tuned to the operator's look (§8).**
- **Backend:** Next.js API routes (or thin Node service) — RESTful, Zod-validated, structured error envelopes, audit logging on mutations. Long-running AI pipelines use fire-and-forget + progress-polling (return 202, poll status) so the UI streams pipeline progress per stage with timing.
- **Database:** PostgreSQL (Prisma ORM). UUID PKs, soft deletes, JSON fields for flexible structures (intents, plans, extracted fields), audit + AI-call tables. SQLite-via-Prisma acceptable for local simplicity but model as Postgres-ready.
- **AI:** Anthropic API. Native PDF + image understanding for document extraction (no separate OCR). Multi-tier routing (Haiku-class fast / Sonnet- or Opus-class reasoning). Centralized LLM client with retry, structured-output parsing, **confidence capture**, cost tracking, prompt-version logging.
- **Auth:** session-based, role-aware (Reviewer / Admin) so RBAC + audit are demonstrable.
- **State/data:** TanStack Query; Zustand only if needed.

> **Build note (this implementation):** per the build plan, the stack is the latest stable: Next.js 16 + React 19 + Tailwind v4; database is SQLite locally and **Turso (libSQL)** in production via the Prisma driver adapter (modeled exactly as the Postgres-ready schema this spec describes); deployable on Vercel with document storage in Vercel Blob.

---

## 6. ARCHITECTURE — SHARED CORE, MULTIPLE SURFACES

Build the engine as a clearly separated, reusable core that all surfaces call (good engineering; keeps the product DRY and consistent). Presented to users simply as one platform.

### 6.1 Engine modules (shared core)
- `engine/intake/` — unstructured input → structured intent/document model (LLM).
- `engine/rules/` — market ruleset loader + rule interpreter (LLM over rulesets).
- `engine/retrieval/` — LLM query planner + deterministic executor.
- `engine/generation/` — compliant output generator (LLM) + provenance capture.
- `engine/validation/` — self-check + figure-vs-source verification + confidence (LLM + deterministic).
- `engine/risk/` — risk scoring + anomaly + expiry forecasting (LLM + deterministic).
- `engine/explain/` — explainability/rationale generation (LLM).
- `engine/compliance/` — the regulatory-constraint framework (§7.A): residency, PII, retention, lawful-basis policies per market, enforced across pipelines.
- `engine/accuracy/` — the accuracy & confidence layer (§7.B): confidence scoring, ground-truth eval harness, confidence-gating policy.
- `engine/governance/` — audit logging, human-in-the-loop state machine, approval workflow.
- `engine/llm/` — centralized Anthropic client, model router, prompt registry, cost ledger.

### 6.2 Surface modules (thin, on top of engine)
- `surfaces/authority-request/` — ARR orchestration, schemas, screens.
- `surfaces/fleet-onboarding/` — B1 orchestration, schemas, screens.
- `surfaces/fleet-monitoring/` — B2 orchestration, schemas, screens (distinct lifecycle/state machine).

### 6.3 Pipeline pattern
A surface defines a **pipeline** = ordered typed stages `(ctx) -> ctx`, each emitting progress + AI output + timing the UI renders live. ARR and B1 are pipeline configurations of the same runner; B2 adds a continuous monitoring loop on top of the same validation machinery.

### 6.4 Governance state machines
- **ARR / B1:** `RECEIVED -> PROCESSING -> PENDING_REVIEW -> (APPROVED | REJECTED | NEEDS_CLARIFICATION) -> DONE`.
- **B2:** `COMPLIANT -> (EXPIRING_SOON | DRIFT_DETECTED) -> PENDING_REVIEW -> (REMEDIATED | CONDITIONS_APPLIED | SUSPENDED_RECOMMENDED) -> COMPLIANT`. No binding/submitted/suspended state without a human action. Enforced in `engine/governance/`.

### 6.5 Provenance (first-class)
Every generated figure/decision carries provenance to source row(s) + the prompt/version that produced it. UI lets users click any output value → see its source. Core, not optional.

### 6.6 Audit (immutable)
Every meaningful action (human or AI) appended to `audit_log` with actor, action, entity, before/after, timestamp, and (for AI) model + prompt version + cost + confidence. Surfaced in an audit view.

### 6.7 Prompt registry
All prompts as versioned files under `engine/llm/prompts/` (e.g., `intake.request.v1.md`). LLM client logs which version produced which output. Traceable; demonstrates eval discipline.

### 6.8 Cost ledger
Every LLM call logs tokens + model + cost; dashboard shows cost per request/partner + totals alongside time-saved.

---

## 7. TWO CRITICAL SUBSYSTEMS — BUILD THESE WITH FULL RIGOR

### 7.A Regulatory Compliance-Constraint Framework (`engine/compliance/`)
A robust, structured policy layer — not a hand-wave. For each market, the ruleset declares a typed **compliance policy** covering:
- **Data residency:** whether specified data classes may leave the market / region; cross-border transfer rules (e.g., intra-EU permitted, EU-to-non-EU restricted; NDPA/POPIA cross-border rules for NG/ZA). The engine checks every retrieval/output against residency policy and **flags or constrains** outputs that would violate it.
- **PII handling & minimization:** which fields are PII; when they must be minimized, masked, or aggregated in an authority report; lawful-basis tagging for each data use.
- **Lawful basis:** for each authority request, the engine records the cited legal basis and whether the requested data is answerable under that basis in that market; flags overreach.
- **Retention:** how long request data / partner data is retained per market; retention reflected in audit and storage policy.
- **Purpose limitation:** the requested data's use must match the stated regulatory purpose; mismatches flagged.

Implementation: each market ruleset includes a `compliancePolicy` block (typed). `engine/compliance/` exposes checks the ARR/B1/B2 pipelines call at retrieval, generation, and output stages. Every constraint decision is **explainable** (why a field was masked/withheld/aggregated) and **audited**. Keep specifics **directionally realistic and clearly labeled illustrative** — demonstrate the *mechanism* (a structured, enforced, explainable constraint engine) rather than asserting precise legal citations that could be wrong. This subsystem is a core differentiator: it shows governance is architectural, enforced, and explainable.

### 7.B Accuracy & Confidence Layer (`engine/accuracy/`)
For a compliance product, "how do you know the AI is right?" must have a visible, rigorous answer. Build:
- **Per-field confidence:** every extracted field and every generated figure carries a confidence score from the LLM + deterministic cross-checks.
- **Confidence-gating policy:** below a threshold, a field/decision **cannot pass silently** — it is flagged for mandatory human review. Wire this into the human-in-the-loop gates.
- **Figure-vs-source verification:** every figure in any output is verified against its source data; mismatches block completion.
- **Ground-truth eval harness:** because synthetic documents are generated with **known ground-truth structured data behind them**, the system can measure extraction/validation accuracy against ground truth. Provide an **Accuracy view** showing measured accuracy (precision/recall on extraction, validation correctness) over the synthetic corpus, plus per-field confidence distributions.
- **Calibration surfacing:** show whether high-confidence outputs are right more often than low-confidence ones.
This layer makes correctness visible and is a major credibility multiplier for a governance-grade product.

---

## 8. UI/UX — MATCH BOLT'S DESIGN LANGUAGE

Must look like it belongs inside Bolt's own product. Hard requirement.

### 8.0 STEP ZERO — STUDY BOLT'S REAL DESIGN BEFORE WRITING ANY UI CODE
Before building any frontend, **research Bolt's actual design language** and extract real tokens. Search Bolt's live brand and product surfaces; extract Bolt's **real** values: exact brand green (and full palette), the **actual typeface**, corner radii, button shapes and states, spacing scale, elevation/shadow style, iconography style, density and feel. Capture the Bolt **logo** (wordmark + bolt symbol) and the correct green. Codify into design tokens before building screens; note source values in `/docs/DECISIONS.md`.

> **Build note:** research complete — brand green `#34D186`, light green `#BDF4D3`, Inter typeface, 4px button / 8–12px card radii, 4px spacing base, subtle two-tier shadows, whitespace-heavy flat card layouts. Sources recorded in `docs/DECISIONS.md`. Tokens live in `app/globals.css` (Tailwind v4 `@theme`).

### 8.1 Branding — this product is "Bolt Sentinel"
- Brand the product as **"Bolt Sentinel"** throughout (app title, nav header, login, document/report headers, exports).
- Use the **Bolt logo** (bolt symbol + wordmark) in the top-left nav / header, lockup-style with "Sentinel" as the product name, in Bolt's brand green.
- Reports and exports carry a "Bolt Sentinel" header so generated authority reports look like official Bolt internal documents.
- **IP guardrail (important):** this Bolt branding is for the **private demo shown directly to Bolt** only. Do NOT publish it publicly or present it as Bolt-affiliated. If ever placed in a public portfolio, swap the Bolt logo/name for a neutral mark and label it "concept built for a Bolt application." Noted in `README.md`.

**Design tokens:** Primary brand green `#34D186`. Foundation: clean white / very-light-gray surfaces, near-black text `#1A1A1A`, generous whitespace, subtle borders/shadows. Typography: Inter. Status colors: green = compliant/valid/approved; amber = expiring/needs-attention; red = invalid/missing/rejected/overdue; neutral gray = pending/processing. Components: card layouts, clean data tables, side panels, pipeline/stepper visualizations with per-stage timing, status badges, SLA/expiry countdown chips, time-saved contrast chips/banners. Layout: left nav (Home, Authority Requests, Fleet Onboarding, Compliance Monitoring, Audit, Assistant), top bar with market filter + user, dashboard-first main area.

---

## 9. THE BEFORE/AFTER VALUE CONTRAST — THREAD IT THROUGHOUT

- **Per-item completion:** show **"Manual baseline: ~Xh / Sentinel: Ys"** with actual elapsed processing time and the modeled manual baseline (configurable, labeled estimates).
- **Per-stage timing:** the pipeline stepper shows how long each AI stage took.
- **Portfolio level (dashboard):** cumulative **"hours saved this month"**, plus cost ledger total.
- **Monitoring (B2):** "compliance gaps caught proactively this month" / "incidents prevented" style counters (clearly modeled).
- **Audit/report footer:** elapsed time + cost + model used, for traceability.
Keep all baselines clearly labeled as estimates; the *contrast device* is the point.

---

## 10. WHAT TO BUILD — CONCRETE DELIVERABLES CHECKLIST

**Shared:** Home dashboard; global conversational assistant (Cmd-K), grounded + cited; auth + roles (Reviewer/Admin) + RBAC; audit log + audit view (model/prompt-version/cost/confidence); provenance system (click figure → source); prompt registry + cost ledger + model router; compliance-constraint framework (§7.A); accuracy & confidence layer (§7.B) with Accuracy view; market ruleset abstraction (6 markets) + synthetic data + ground-truth seed; time-saved contrast device throughout.

**Surface A — ARR:** requests inbox; request workspace with live staged AI pipeline + per-stage timing; AI intake→intent, rule mapping→compliance plan/checklist (+ §7.A), retrieval plan+exec, report generation, self-validation + confidence; compliance checklist panel; generated report preview + provenance + export (PDF/structured) + time-saved; human review/approve/reject/regenerate.

**Surface B1 — Onboarding:** onboarding queue; onboarding workspace; AI document extraction (native PDF/image) → typed fields + gap/low-confidence flagging; required-document checklist per market/type; validation + cross-document checks with rationale + confidence; risk scoring with explainable factors; document viewer (original ↔ extracted fields + rationale + confidence); drafted onboarding decision + human approve/conditions/reject + time-saved.

**Surface B2 — Monitoring (distinct flow):** monitoring dashboard (portfolio health, market filter); expiry pipeline (timeline, severity); AI expiry forecasting + proactive gap prediction; AI drift & gap detection; re-validation on renewal (reuses B1 validation); at-risk partners list (risk trend, reason, recommended action); partner monitoring detail (compliance history, document timeline); proactive re-trigger → human decision.

**Quality bar:** no broken flows, no placeholder buttons, no lorem ipsum. Realistic synthetic data producing genuinely interesting scenarios (§11). Smooth, polished, Bolt-looking.

---

## 11. SYNTHETIC SCENARIOS TO SEED

**Surface A:**
- **Tallinn:** a clean, fully-answerable multi-part request citing a regulation, asking for driver license validity + trip counts in a zone for Q1 → happy path with strong time-saved contrast.
- **Warsaw:** a request with an **ambiguity** (vague date range) → system surfaces a clarification rather than guessing.
- **Lagos:** a request asking for a field that **NDPA data-residency / PII rules constrain** → §7.A flags the constraint and the report masks/aggregates correctly, with explanation.
- **Johannesburg:** a request whose cited **lawful basis doesn't cover** part of what's asked → engine flags overreach.
- **Lisbon / Bucharest:** additional clean requests showing market-specific report formats differ.

**Surface B1 (onboarding):**
- A **clean partner** → fast approve path.
- A partner with a **name mismatch** between operator license and business registration → cross-check catches it.
- A partner **missing a required market-specific document** → checklist catches gap → "approve-with-conditions" draft.
- A partner with a **low-confidence extraction** on one document → confidence-gating forces human review.

**Surface B2 (monitoring):**
- A partner with **2 vehicle inspections expiring in 21 days** → expiry forecast + proactive alert + risk bump.
- A partner who **added vehicles without valid registrations** → drift detection flags it.
- A partner who **submits a renewed insurance doc** → re-validation updates status to compliant without re-onboarding.
- A market **ruleset update** → affected partners re-flagged for review.

---

## 12. FILES TO CREATE

In addition to application code: `CLAUDE.md` (root — primary AI context), `AGENTS.md` (root — multi-agent orchestration guide), `SPEC.md` (this document), `README.md` (root), `ARCHITECTURE.md` (/docs — shared core in depth), `engine/llm/prompts/` (versioned prompt files), `prisma/schema.prisma` (full data model), `seed/` (markets, rulesets, synthetic data + ground-truth + scenarios), `/docs/DECISIONS.md` (key decisions and why).

---

## 13. BUILD ORDER

0. Study Bolt's design (done). 1. Scaffold + design tokens + branding + root files. 2. Data model + seed (6 rulesets + compliance policies + synthetic data + ground-truth + scenarios). 3. LLM core. 4. Shared engine (pipeline runner, governance, audit, provenance, rules, §7.A, §7.B). 5. Surface A. 6. Surface B1. 7. Surface B2. 8. Shared dashboard + assistant + Accuracy view. 9. Polish. 10. Verify every §10 item and §11 scenario.

---

## 14. NON-NEGOTIABLES (DO NOT SHIP WITHOUT)

- All surfaces (A, B1, B2) work fully, end-to-end, flawless, on synthetic data. No stubs in any user-visible path. No demo subset.
- AI used at every value-adding stage (§2).
- Human-in-the-loop before anything binds. Never auto-submits to an authority; never auto-decides/auto-suspends a partner.
- Compliance-constraint framework (§7.A) enforced and explainable across pipelines.
- Accuracy & confidence layer (§7.B) present, working, and visible (Accuracy view + confidence-gating).
- Provenance on every generated figure, clickable to source.
- Full audit trail (model, prompt version, cost, confidence) with audit view.
- Before/after time-saved contrast surfaced throughout (§9).
- Bolt-grade UI built from researched real Bolt design tokens (§8), branded "Bolt Sentinel" with the Bolt logo (private-demo use only, per §8.1 IP guardrail).
- Market = ruleset file — adding a market needs no code change.
- Cost ledger + prompt registry present and working.
- Onboarding (B1) and Monitoring (B2) are distinct, fully-built flows, not merged.
- No placeholder text, no lorem ipsum, no broken links, no TODO buttons anywhere.

> Build to impress an engineer who will look for what's fake. Make nothing fake. Make it real, make it work, make it complete, and make it look like Bolt built it — Bolt Sentinel, Bolt's real design language, Bolt's logo.
