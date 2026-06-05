/**
 * Bolt Sentinel — User Guide content. Data-driven (rendered by guide-view.tsx), so the guide is
 * authored here as structured blocks. Written as production documentation for the Regulatory
 * Operations Platform.
 */

export interface ParagraphBlock { type: "paragraph"; text: string }
export interface HeadingBlock { type: "heading"; level: 2 | 3 | 4; text: string }
export interface CalloutBlock { type: "callout"; variant: "tip" | "warning" | "info" | "danger"; title?: string; text: string }
export interface StepsBlock { type: "steps"; steps: Array<{ title: string; description: string }> }
export interface TableBlock { type: "table"; headers: string[]; rows: string[][] }
export interface LinkCardBlock { type: "link-card"; title: string; description: string; href: string }
export type ContentBlock = ParagraphBlock | HeadingBlock | CalloutBlock | StepsBlock | TableBlock | LinkCardBlock;

export interface GuideSubsection { id: string; title: string; content: ContentBlock[] }
export interface GuideSection { id: string; title: string; icon: string; description: string; keywords: string[]; subsections: GuideSubsection[] }

export const GUIDE_SECTIONS: GuideSection[] = [
  // 1 ─────────────────────────────────────────────────────────────────────
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "book-open",
    description: "What Bolt Sentinel is, how to sign in, and how the console is organized.",
    keywords: ["start", "overview", "intro", "login", "sign in", "console", "theme"],
    subsections: [
      {
        id: "what-is-sentinel",
        title: "What Bolt Sentinel is",
        content: [
          { type: "paragraph", text: "**Bolt Sentinel** is the Regulatory Operations Platform for the ride-hailing business across six markets — Estonia (Tallinn), Poland (Warsaw), Portugal (Lisbon), Romania (Bucharest), Nigeria (Lagos), and South Africa (Johannesburg). It runs three operational surfaces on one shared compliance-intelligence engine." },
          { type: "steps", steps: [
            { title: "Authority Request Response", description: "Interpret a regulator's request, map it to the market's legal requirements, retrieve the data, and produce a compliant, fully-traceable report for review and submission." },
            { title: "Fleet Partner Onboarding", description: "Validate a partner's document pack against market rules, cross-check across documents, risk-score, and draft a go / no-go decision." },
            { title: "Ongoing Compliance Monitoring", description: "Continuously watch the live partner portfolio for upcoming expiries and emerging drift, re-validate on renewal, and proactively re-trigger review." },
          ] },
          { type: "paragraph", text: "Every figure traces to its source, every output carries a confidence score, and nothing binds without a human decision. Sentinel proposes; you decide." },
        ],
      },
      {
        id: "signing-in",
        title: "Signing in",
        content: [
          { type: "paragraph", text: "Sign in with your work email and password. Your account is provisioned by an administrator with one or more **roles** that determine what you can see and do." },
          { type: "callout", variant: "info", title: "Your active role", text: "If you hold more than one role, you act through one **active role** at a time. Switch it from the top-right of any screen — the navigation and available actions update to match." },
        ],
      },
      {
        id: "console-layout",
        title: "Navigating the console",
        content: [
          { type: "paragraph", text: "The left sidebar groups the surfaces under **Operations** (Home, Authority Requests, Fleet Onboarding, Compliance Monitoring) and **Governance** (Markets & Rules, Regulation Intake, Accuracy, Audit & Cost, Assistant). **Settings** and the **User Guide** sit just below the Governance group, and your account panel is at the very bottom of the sidebar. The navigation only shows what your active role can access." },
          { type: "table", headers: ["Top bar control", "What it does"], rows: [
            ["Market filter", "Scope the entire console to one market, or view all markets."],
            ["Ask (⌘J)", "Open the Sentinel Assistant chat from anywhere."],
            ["Theme toggle", "Switch between dark (default) and light. Your choice is remembered."],
            ["Role switcher", "Change your active role when you hold more than one."],
          ] },
          { type: "callout", variant: "tip", text: "The market filter is sticky across screens, so you can work a single market end to end without re-selecting it." },
          { type: "heading", level: 4, text: "Keyboard & quick actions" },
          { type: "table", headers: ["Action", "What it does"], rows: [
            ["⌘J / Ctrl-J", "Open the Sentinel Assistant chat."],
            ["⌘K / Ctrl-K", "Open the command palette — jump to any screen, or hand a question to the assistant."],
            ["Click any figure", "Reveal its provenance: the exact source records and the rule it satisfies."],
            ["Expand a pipeline stage", "Inspect that stage's output, model, and confidence."],
          ] },
        ],
      },
      {
        id: "key-concepts",
        title: "Key concepts",
        content: [
          { type: "paragraph", text: "A few terms recur throughout Sentinel:" },
          { type: "table", headers: ["Term", "Meaning"], rows: [
            ["Ruleset", "The machine-readable definition of a market's regulatory requirements — required documents, validations, answerable fields, report format, and data policy."],
            ["Pipeline", "The ordered sequence of AI stages that processes a request, onboarding, or regulation; each stage reports live progress, timing, and confidence."],
            ["Provenance", "The exact source records (and prompt version) behind a figure — clickable on every number."],
            ["Confidence", "A calibrated 0–100% score on every output; low confidence gates the output to human review."],
            ["Human-in-the-loop", "A required human decision before anything binds — submission, onboarding, suspension, or rule activation."],
            ["Drift", "A material change in a partner's compliance state since the last review (e.g. a lapsed document, or a vehicle added without valid registration)."],
            ["Data residency", "Whether a market's data may leave its region; enforced as data moves through the engine."],
          ] },
        ],
      },
    ],
  },

  // 2 ─────────────────────────────────────────────────────────────────────
  {
    id: "roles-access",
    title: "Roles & Access",
    icon: "users",
    description: "How role-based access control works, switching your active role, and managing the team.",
    keywords: ["rbac", "roles", "permissions", "access", "team", "admin", "switch"],
    subsections: [
      {
        id: "roles",
        title: "Roles",
        content: [
          { type: "paragraph", text: "Access is governed by roles. Each role grants a specific set of permissions across the surfaces. A user can hold several roles and switch between them." },
          { type: "table", headers: ["Role", "Can do"], rows: [
            ["Administrator", "Full access — settings, connectors, user management, and every surface."],
            ["Compliance Reviewer", "Review and approve authority-request reports; view accuracy and audit."],
            ["Onboarding Officer", "Make fleet-partner go / no-go decisions."],
            ["Compliance Monitor", "Watch the live portfolio; remediate drift and expiries."],
            ["Regulatory Author", "Import regulations and activate market rulesets."],
            ["Authority Liaison", "Export and submit reports to authorities."],
            ["Auditor", "Read-only access to audit, accuracy, and records."],
          ] },
          { type: "paragraph", text: "The full role-to-permission matrix is shown in **Settings → Team & Roles**." },
        ],
      },
      {
        id: "switching-roles",
        title: "Switching your active role",
        content: [
          { type: "paragraph", text: "When you hold more than one role, the top-right role switcher lets you act through any one of them. Switching changes the navigation and the actions available to you — it is the lens you operate through." },
          { type: "callout", variant: "info", text: "Switching role takes effect immediately and is recorded on the audit trail. You only ever see roles that have been assigned to you." },
        ],
      },
      {
        id: "managing-users",
        title: "Managing the team (administrators)",
        content: [
          { type: "paragraph", text: "Administrators manage people in **Settings → Team & Roles**." },
          { type: "steps", steps: [
            { title: "Add a teammate", description: "Provide their name, email, and an initial password, then assign one or more roles." },
            { title: "Assign roles", description: "Toggle role chips on any user. Changes save immediately; a user always retains at least one role." },
            { title: "Deactivate", description: "Turn off a user's Active switch to revoke access without deleting their history." },
          ] },
          { type: "link-card", title: "Open Team & Roles", description: "Add users, assign roles, and review the RBAC matrix.", href: "/settings" },
        ],
      },
    ],
  },

  // 3 ─────────────────────────────────────────────────────────────────────
  {
    id: "home",
    title: "Home Dashboard",
    icon: "layout-dashboard",
    description: "Your operational cockpit — what needs attention right now.",
    keywords: ["home", "dashboard", "cockpit", "kpi", "overview"],
    subsections: [
      {
        id: "cockpit",
        title: "The cockpit",
        content: [
          { type: "paragraph", text: "Home opens to a portfolio-wide snapshot: headline metrics, the open authority requests, the partners and items needing attention, and a feed of recent AI activity." },
          { type: "paragraph", text: "Use it to triage your day — every card links straight into the relevant workspace. Scope it to a single market with the top-bar filter." },
          { type: "link-card", title: "Open Home", description: "Your portfolio cockpit.", href: "/home" },
        ],
      },
    ],
  },

  // 4 ─────────────────────────────────────────────────────────────────────
  {
    id: "authority-requests",
    title: "Authority Request Response",
    icon: "inbox",
    description: "Turn a regulator's request into a compliant, fully-traceable report for submission.",
    keywords: ["arr", "authority", "regulator", "request", "report", "export", "submit"],
    subsections: [
      {
        id: "arr-inbox",
        title: "The request inbox",
        content: [
          { type: "paragraph", text: "The inbox lists incoming authority requests with their market, status, and deadline. The SLA chip shows how much time remains before the response is due." },
          { type: "paragraph", text: "Open a request to enter its workspace, where the AI pipeline interprets and answers it." },
        ],
      },
      {
        id: "arr-pipeline",
        title: "Running the pipeline",
        content: [
          { type: "paragraph", text: "In the workspace, start the pipeline to process the request. Each stage runs in sequence and reports live progress, timing, and confidence." },
          { type: "steps", steps: [
            { title: "Intake → Intent", description: "Reads the request and extracts a structured intent: what is being asked, for which subjects, over which period and zone." },
            { title: "Rule mapping", description: "Interprets the market ruleset to decide which fields are answerable, cautioned, or out of scope, and the mandated report format." },
            { title: "Retrieval planning & execution", description: "Plans a typed query, then a deterministic executor computes each figure from source records — the model never queries data directly." },
            { title: "Generation", description: "Drafts the compliant report in the market's mandated format, with every figure attributed to its source." },
            { title: "Self-validation", description: "An independent check verifies every figure against its source and confirms the report meets the compliance checklist." },
          ] },
          { type: "callout", variant: "warning", title: "Clarification", text: "If a request is genuinely ambiguous (for example, an unspecified reporting period), the pipeline pauses and flags it for clarification rather than guessing." },
        ],
      },
      {
        id: "arr-review",
        title: "Reviewing provenance & confidence",
        content: [
          { type: "paragraph", text: "Every figure in the report is clickable: it reveals the exact source records, the aggregation applied, and the rule it satisfies. Confidence is shown per output, and low-confidence or unverified figures are flagged for your attention." },
          { type: "paragraph", text: "The compliance checklist and self-validation results sit alongside the report so you can confirm completeness before approving." },
        ],
      },
      {
        id: "arr-approve",
        title: "Approving & exporting",
        content: [
          { type: "paragraph", text: "When you are satisfied, approve the request. You can then export the report as a formatted document for submission to the authority." },
          { type: "callout", variant: "danger", title: "Submission is a human action", text: "Sentinel never submits to an authority on its own. It prepares the report; a person reviews, approves, and submits." },
          { type: "link-card", title: "Open Authority Requests", description: "Work the request inbox.", href: "/authority-requests" },
        ],
      },
    ],
  },

  // 5 ─────────────────────────────────────────────────────────────────────
  {
    id: "fleet-onboarding",
    title: "Fleet Partner Onboarding",
    icon: "truck",
    description: "Validate a partner's documents, cross-check, risk-score, and draft a decision.",
    keywords: ["onboarding", "b1", "partner", "documents", "extraction", "risk", "decision"],
    subsections: [
      {
        id: "onboarding-queue",
        title: "The onboarding queue",
        content: [
          { type: "paragraph", text: "The queue lists partners awaiting onboarding with their market, type, fleet size, document completeness, risk, and status. Open a partner to review their pack." },
        ],
      },
      {
        id: "onboarding-extraction",
        title: "Extraction, validation & cross-checks",
        content: [
          { type: "paragraph", text: "The pipeline reads each uploaded document, extracts the expected fields with per-field confidence, validates them against the market's rules, and cross-checks values across documents (for example, that the licence holder's name matches the insurance)." },
          { type: "paragraph", text: "The document viewer shows each file alongside its extracted fields; low-confidence or illegible regions are flagged so you can verify them." },
          { type: "callout", variant: "info", text: "Required documents and validation rules are defined per market in the ruleset, so an Estonian partner and a Nigerian partner are held to the correct, market-specific standards." },
        ],
      },
      {
        id: "onboarding-decision",
        title: "Risk score & decision",
        content: [
          { type: "paragraph", text: "An explainable risk score summarizes the partner, with the contributing factors listed. The pipeline drafts a recommended decision; you make the final call." },
          { type: "steps", steps: [
            { title: "Approve", description: "The partner meets all requirements." },
            { title: "Approve with conditions", description: "Onboard, but record conditions to resolve (for example, a document expiring soon)." },
            { title: "Reject", description: "Requirements are not met; the rationale is recorded." },
          ] },
          { type: "link-card", title: "Open Fleet Onboarding", description: "Review partner packs and decide.", href: "/fleet-onboarding" },
        ],
      },
    ],
  },

  // 6 ─────────────────────────────────────────────────────────────────────
  {
    id: "monitoring",
    title: "Compliance Monitoring",
    icon: "shield-check",
    description: "Continuously watch the live portfolio for expiries and drift, and re-validate on renewal.",
    keywords: ["monitoring", "b2", "portfolio", "expiry", "drift", "revalidate", "sweep"],
    subsections: [
      {
        id: "monitoring-dashboard",
        title: "The monitoring dashboard",
        content: [
          { type: "paragraph", text: "Monitoring shows portfolio health at a glance: compliant vs. at-risk partners, the upcoming-expiry pipeline, the at-risk list, and proactive alerts." },
        ],
      },
      {
        id: "monitoring-sweep",
        title: "Sweeps, expiry forecasting & drift",
        content: [
          { type: "paragraph", text: "A monitoring sweep re-examines the portfolio. It forecasts which credentials, inspections, and licences are about to expire, and detects **drift** — material changes such as vehicles added without valid registration, or a lapsed document." },
          { type: "paragraph", text: "Sweeps run on a schedule and can also be triggered manually from the dashboard." },
        ],
      },
      {
        id: "monitoring-actions",
        title: "Partner detail & actions",
        content: [
          { type: "paragraph", text: "Open a partner to see their compliance history and a document-validity timeline. When a renewed document is submitted, re-validation confirms the partner is back in good standing." },
          { type: "callout", variant: "danger", title: "No automatic suspension", text: "Sentinel never auto-suspends a partner. Drift and expiries are routed to a person, who chooses to remediate, apply conditions, or recommend suspension." },
          { type: "link-card", title: "Open Compliance Monitoring", description: "Watch the live portfolio.", href: "/compliance-monitoring" },
        ],
      },
    ],
  },

  // 7 ─────────────────────────────────────────────────────────────────────
  {
    id: "markets-rules",
    title: "Markets & Rules",
    icon: "scale",
    description: "The machine-readable ruleset behind every market — documents, validations, fields, and policy.",
    keywords: ["markets", "rules", "ruleset", "regulation", "policy", "versions"],
    subsections: [
      {
        id: "ruleset-model",
        title: "How rules are modeled",
        content: [
          { type: "paragraph", text: "Each market is governed by a versioned, machine-readable **ruleset** that defines its required documents, validation rules, the figures a regulator can ask for, the mandated report format, and the data-protection policy (residency, lawful bases, retention)." },
          { type: "paragraph", text: "Because a market is a ruleset, adding or changing a market is a new ruleset version — not an engineering change. The database is the single source of truth for every rule." },
        ],
      },
      {
        id: "browsing-markets",
        title: "Browsing markets",
        content: [
          { type: "paragraph", text: "The Markets & Rules screen lists every market with its regulator, privacy regime (GDPR, NDPA, or POPIA), and data-residency posture. Filter by regime, region, or residency, and search by regulator or document type." },
        ],
      },
      {
        id: "ruleset-detail",
        title: "Inside a ruleset",
        content: [
          { type: "paragraph", text: "Open a market to see the full ruleset: required documents (with expected fields and validation rules), cross-document checks, authority-answerable fields, the mandated report format, the risk model, and the §7.A compliance policy. A version history shows how the ruleset has evolved." },
          { type: "link-card", title: "Open Markets & Rules", description: "Browse the regulatory rulesets.", href: "/rules" },
        ],
      },
    ],
  },

  // 8 ─────────────────────────────────────────────────────────────────────
  {
    id: "regulation-intake",
    title: "Regulation Intake",
    icon: "file-up",
    description: "Upload a regulation; Sentinel proposes a complete market ruleset for you to review and activate.",
    keywords: ["regulation", "intake", "upload", "ruleset", "activate", "synthesize", "import"],
    subsections: [
      {
        id: "intake-upload",
        title: "Uploading a regulation",
        content: [
          { type: "paragraph", text: "When a regulation changes, upload the document (PDF or pasted text) on the Regulation Intake screen. Sentinel reads it and proposes a machine-readable ruleset — it activates nothing on its own." },
        ],
      },
      {
        id: "intake-pipeline",
        title: "How it is processed",
        content: [
          { type: "steps", steps: [
            { title: "Read", description: "The regulation is decomposed into quotable sections." },
            { title: "Classify", description: "The jurisdiction, regulator, and privacy regime are identified, and Sentinel decides whether this is a new market or a new version of an existing one." },
            { title: "Synthesize", description: "A complete ruleset is proposed — documents, validations, answerable fields, and policy — with every rule traced to the clause that justifies it." },
            { title: "Validate", description: "The draft is checked against the schema, its data sources are confirmed executable, and an independent review flags gaps or overreach." },
            { title: "Diff", description: "For an update, the changes versus the current version are summarized." },
          ] },
        ],
      },
      {
        id: "intake-activate",
        title: "Reviewing & activating",
        content: [
          { type: "paragraph", text: "Review the proposed ruleset alongside its provenance and the validation findings. Anything Sentinel could not confidently map is surfaced for you to wire — never invented." },
          { type: "callout", variant: "danger", title: "Activation is a human decision", text: "A proposed ruleset is held until a person activates it. Activation creates the market (or a new version), makes it the live ruleset, and re-flags affected partners for re-validation." },
          { type: "link-card", title: "Open Regulation Intake", description: "Import a regulation.", href: "/regulation-intake" },
        ],
      },
    ],
  },

  // 9 ─────────────────────────────────────────────────────────────────────
  {
    id: "accuracy",
    title: "Accuracy & Confidence",
    icon: "target",
    description: "How extraction accuracy is measured and how confidence gates human review.",
    keywords: ["accuracy", "confidence", "precision", "recall", "calibration", "gating", "thresholds"],
    subsections: [
      {
        id: "accuracy-metrics",
        title: "Measuring accuracy",
        content: [
          { type: "paragraph", text: "The Accuracy screen reports extraction precision, recall, and F1, a calibration measure (how well stated confidence matches measured accuracy), the distribution of per-field confidence, and the rate at which the confidence gate catches defects." },
        ],
      },
      {
        id: "accuracy-gating",
        title: "The confidence-gating policy",
        content: [
          { type: "paragraph", text: "Every figure is gated by confidence so that uncertain results never pass silently." },
          { type: "table", headers: ["Confidence", "Outcome"], rows: [
            ["At or above the pass bar", "Accepted (higher bars apply to financial and sensitive fields)."],
            ["Between review and pass", "Completes, but flagged for mandatory human attention."],
            ["Below the review bar", "Blocks and opens a review gate."],
          ] },
          { type: "callout", variant: "info", text: "A figure that fails the figure-vs-source check, or a validation mismatch, also blocks — regardless of the stated confidence. Thresholds are configurable in Settings → Confidence & Accuracy." },
          { type: "link-card", title: "Open Accuracy", description: "Review accuracy and calibration.", href: "/accuracy" },
        ],
      },
    ],
  },

  // 10 ────────────────────────────────────────────────────────────────────
  {
    id: "audit-cost",
    title: "Audit & Cost",
    icon: "scroll-text",
    description: "The tamper-evident audit trail and the AI cost ledger.",
    keywords: ["audit", "log", "hash", "chain", "cost", "ledger", "integrity"],
    subsections: [
      {
        id: "audit-log",
        title: "The audit trail",
        content: [
          { type: "paragraph", text: "Every meaningful action — each AI call, constraint decision, review gate, human decision, and state change — is appended to a hash-chained, tamper-evident audit log. AI entries also carry the model, prompt version, cost, and confidence." },
          { type: "callout", variant: "tip", text: "You can verify the chain's integrity at any time from Settings → Audit & Security." },
        ],
      },
      {
        id: "cost-ledger",
        title: "The cost ledger",
        content: [
          { type: "paragraph", text: "Every AI operation records its token usage and cost, so you can see exactly what each request, onboarding, or sweep cost to process, and track spend over time." },
          { type: "link-card", title: "Open Audit & Cost", description: "Inspect the audit trail and spend.", href: "/audit" },
        ],
      },
    ],
  },

  // 11 ────────────────────────────────────────────────────────────────────
  {
    id: "assistant",
    title: "Assistant",
    icon: "sparkles",
    description: "A grounded conversational assistant with live answers, source previews, and charts.",
    keywords: ["assistant", "ask", "chat", "cmd+j", "questions", "citations", "charts", "history", "streaming"],
    subsections: [
      {
        id: "using-assistant",
        title: "Asking questions",
        content: [
          { type: "paragraph", text: "Open the assistant from the **chat button** in the bottom-right of any screen, the **Ask** button in the top bar, or **⌘J**. Ask about your portfolio in plain language — expiring documents, partners flagged for drift, the status of a request, a breakdown by market." },
          { type: "paragraph", text: "Answers **stream in live** and are written in rich text — with lists, tables, and **charts** when the answer is quantitative (for example, at-risk partners by market)." },
          { type: "callout", variant: "info", title: "Grounded answers", text: "The assistant answers only from your real data. If there is no supporting record, it says so plainly rather than guessing. It also proposes a few **suggested follow-up questions** after each answer (and starter questions when you begin)." },
        ],
      },
      {
        id: "assistant-sources-history",
        title: "Source previews, charts & saved chats",
        content: [
          { type: "paragraph", text: "Records are **linked inline** in the answer. Click a partner or request name to **preview** it — a card with its key fields (status, risk, deadline) — then use **Open full page** to drill down. You see the source in context before navigating away." },
          { type: "steps", steps: [
            { title: "History", description: "Every conversation is saved. Reopen past chats from the clock icon in the dock, or the **Conversations** panel on the full Assistant page." },
            { title: "Expand", description: "Use the expand icon in the dock to open the current conversation full-screen on the Assistant page." },
            { title: "New chat", description: "Start a fresh conversation any time with the + icon." },
          ] },
          { type: "link-card", title: "Open the Assistant", description: "Ask a grounded question, with source previews and charts.", href: "/assistant" },
        ],
      },
    ],
  },

  // 12 ────────────────────────────────────────────────────────────────────
  {
    id: "settings",
    title: "Settings",
    icon: "settings",
    description: "Configure the AI engine, data connectors, approval governance, accuracy, team, and notifications.",
    keywords: ["settings", "api key", "model", "connectors", "webhook", "thresholds", "notifications", "general", "workspace", "theme"],
    subsections: [
      {
        id: "settings-general",
        title: "General",
        content: [
          { type: "paragraph", text: "Set the workspace name, the default market the console opens to, and the manual baseline (in hours) used to calculate the time Sentinel saves. Choose your theme — dark, light, or match the system — under Appearance." },
        ],
      },
      {
        id: "settings-ai",
        title: "AI & Models",
        content: [
          { type: "paragraph", text: "Set the Anthropic API key, choose the model for each tier (fast, balanced, reasoning), toggle prompt caching, and set a monthly budget alert. A key set here takes effect immediately for all AI operations." },
        ],
      },
      {
        id: "settings-connectors",
        title: "Connectors & Data",
        content: [
          { type: "paragraph", text: "See the status of the operations datastore and document storage, configure the **intake channels** through which authority requests and partner packs arrive, enable the inbound webhook, and generate **API ingest tokens** for external systems to push data into Sentinel." },
        ],
      },
      {
        id: "settings-governance",
        title: "Approval workflows, accuracy & compliance",
        content: [
          { type: "paragraph", text: "Configure the approval policy (including optional dual-approval for sensitive actions), the §7.B confidence-gating thresholds, and the §7.A compliance defaults (data-residency, retention)." },
        ],
      },
      {
        id: "settings-notifications-security",
        title: "Notifications & security",
        content: [
          { type: "paragraph", text: "Choose which events raise notifications and through which channels (in-app, email, outbound webhook), set the session timeout, and verify the audit chain's integrity." },
          { type: "link-card", title: "Open Settings", description: "Configure the platform.", href: "/settings" },
        ],
      },
    ],
  },

  // Reference ───────────────────────────────────────────────────────────────
  {
    id: "reference",
    title: "Reference & FAQ",
    icon: "book-open",
    description: "Status lifecycles and answers to common questions.",
    keywords: ["status", "faq", "lifecycle", "help", "questions", "states", "troubleshoot"],
    subsections: [
      {
        id: "statuses",
        title: "Statuses at a glance",
        content: [
          { type: "paragraph", text: "Each surface moves items through a defined lifecycle." },
          { type: "table", headers: ["Authority request", "Meaning"], rows: [
            ["Received", "Awaiting processing."],
            ["Processing", "The pipeline is running."],
            ["Needs clarification", "Paused — an ambiguity must be resolved before answering."],
            ["Pending review", "Processed; awaiting your approval."],
            ["Approved / Rejected", "Decided by a reviewer."],
          ] },
          { type: "table", headers: ["Partner onboarding", "Meaning"], rows: [
            ["Processing", "Documents being extracted, validated, and cross-checked."],
            ["Pending review", "A decision is drafted and awaiting yours."],
            ["Approved / Conditions applied / Rejected", "The human decision."],
          ] },
          { type: "table", headers: ["Monitoring", "Meaning"], rows: [
            ["Compliant", "No open issues."],
            ["Expiring soon / Drift detected", "An upcoming expiry or a material change was found."],
            ["Pending review", "Routed to a person to act on."],
            ["Remediated / Conditions applied / Suspension recommended", "The human outcome."],
          ] },
          { type: "table", headers: ["Regulation import", "Meaning"], rows: [
            ["Processing", "The regulation is being read and synthesized into a ruleset."],
            ["Pending review", "A ruleset is proposed and awaiting activation."],
            ["Activated / Rejected", "The human decision."],
          ] },
        ],
      },
      {
        id: "faq",
        title: "Common questions",
        content: [
          { type: "heading", level: 4, text: "Why was an output blocked?" },
          { type: "paragraph", text: "An output blocks when its confidence is below the review threshold, a figure failed the figure-vs-source check, or self-validation found a checklist mismatch. Open the item to see the reason and resolve it." },
          { type: "heading", level: 4, text: "Why can't I see a screen?" },
          { type: "paragraph", text: "Navigation is scoped to your active role. Switch role from the top-right, or ask an administrator to assign the role you need." },
          { type: "heading", level: 4, text: "What does a flagged figure mean?" },
          { type: "paragraph", text: "It completed, but its confidence fell in the review band — so it needs a human to confirm before the output is relied upon." },
          { type: "heading", level: 4, text: "How do I change a market's rules?" },
          { type: "paragraph", text: "Import the updated regulation in [Regulation Intake](/regulation-intake), review the proposed ruleset, and activate it. Activation creates a new version and re-flags affected partners for re-validation." },
          { type: "heading", level: 4, text: "Who can approve, decide, or submit?" },
          { type: "paragraph", text: "Compliance Reviewers and Authority Liaisons handle authority requests; Onboarding Officers decide partners; Compliance Monitors act on drift; Regulatory Authors activate rulesets. Administrators can do everything — see [Settings → Team & Roles](/settings)." },
        ],
      },
    ],
  },

  // Governance ─────────────────────────────────────────────────────────────
  {
    id: "governance",
    title: "Governance & Trust",
    icon: "shield",
    description: "The principles that make Sentinel's outputs trustworthy and defensible.",
    keywords: ["governance", "trust", "human", "provenance", "residency", "compliance", "principles"],
    subsections: [
      {
        id: "principles",
        title: "How you can trust the output",
        content: [
          { type: "steps", steps: [
            { title: "Human-in-the-loop before anything binds", description: "Sentinel never submits to an authority, never auto-decides a partner, and never auto-suspends. It proposes; a person decides." },
            { title: "Provenance on every figure", description: "Every number traces to its exact source records and the prompt version that produced it, and is clickable in the UI." },
            { title: "Figures are computed, not guessed", description: "A deterministic executor is the only thing that queries data; the model plans and narrates but never touches the database, so provenance is real." },
            { title: "Confidence everywhere", description: "Every output carries a confidence score, and uncertain results are gated to human review." },
            { title: "Compliance is enforced", description: "Data-residency, PII, lawful-basis, and retention constraints are applied as the data moves — and explained." },
            { title: "Tamper-evident audit", description: "Every action is recorded on a hash-chained audit log with full attribution." },
          ] },
        ],
      },
    ],
  },
];
