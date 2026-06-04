import { z } from "zod";
import {
  FieldClassificationSchema,
  ValidationOutcomeSchema,
  SeveritySchema,
  CrossCheckOutcomeSchema,
  RiskBandSchema,
  ConstraintActionSchema,
  DataClassSchema,
  RegionSchema,
  PrivacyRegimeSchema,
} from "./enums";
import { SourceEntitySchema, MarketRulesetSchema, type SourceEntity } from "./ruleset";

/**
 * AI artifact contracts. These Zod schemas are converted to JSON Schema for Claude's
 * Structured Outputs (guaranteed-valid JSON) AND describe the shape persisted in the
 * Json columns. Arrays-of-{key,...} are preferred over records for robust structured output.
 */

// ── Provenance ───────────────────────────────────────────────────────────────

export const ProvenanceRefSchema = z.object({
  entity: SourceEntitySchema,
  ids: z.array(z.string()),
  aggregation: z.string().optional(),
  field: z.string().optional(),
  filterDescription: z.string().optional(),
  rulesetRuleId: z.string().optional(),
});
export type ProvenanceRef = z.infer<typeof ProvenanceRefSchema>;

// ── Intake → RequestIntent (ARR) ─────────────────────────────────────────────

export const RequestIntentSchema = z.object({
  summary: z.string().describe("One-sentence plain summary of what the authority is asking for."),
  authority: z.string(),
  legalBasis: z.string().nullish().describe("The cited legal basis / decree, if any."),
  purpose: z.string().describe("The stated regulatory purpose of the request."),
  subjects: z
    .array(z.enum(["DRIVER", "VEHICLE", "FLEET_PARTNER", "TRIP"]))
    .describe("Which entity types the request concerns."),
  requestedFields: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    }),
  ),
  filters: z.object({
    zone: z.string().nullish(),
    periodStart: z.string().nullish().describe("ISO date or null."),
    periodEnd: z.string().nullish(),
    statusFilter: z.string().nullish(),
  }),
  deadline: z.string().nullish().describe("ISO date of the response deadline, if stated."),
  ambiguities: z
    .array(z.string())
    .default([])
    .describe("Anything underspecified that a human must clarify before answering (e.g. vague dates). Empty if none."),
  confidence: z.number().min(0).max(1),
});
export type RequestIntent = z.infer<typeof RequestIntentSchema>;

// ── Rule mapping → CompliancePlan ────────────────────────────────────────────

export const CompliancePlanFieldSchema = z.object({
  requestedField: z.string(),
  mappedFieldKey: z.string().nullish().describe("Ruleset answerable-field key this maps to, or null."),
  classification: FieldClassificationSchema,
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});
export type CompliancePlanField = z.infer<typeof CompliancePlanFieldSchema>;

export const ChecklistItemSchema = z.object({
  id: z.string(),
  requirement: z.string(),
  rationale: z.string(),
  satisfiedBy: z.string().nullish().describe("Which field/section satisfies it (filled after generation)."),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const CompliancePlanSchema = z.object({
  fields: z.array(CompliancePlanFieldSchema),
  checklist: z.array(ChecklistItemSchema),
  formatId: z.string(),
  notes: z.string().describe("How the report must be structured for this authority/market."),
  confidence: z.number().min(0).max(1),
});
export type CompliancePlan = z.infer<typeof CompliancePlanSchema>;

// ── Retrieval planning ───────────────────────────────────────────────────────

export const RetrievalQuerySchema = z.object({
  id: z.string(),
  fieldKey: z.string().describe("The ruleset answerable-field key this query satisfies."),
  rationale: z.string(),
});
export type RetrievalQuery = z.infer<typeof RetrievalQuerySchema>;

export const RetrievalPlanSchema = z.object({
  queries: z.array(RetrievalQuerySchema),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});
export type RetrievalPlan = z.infer<typeof RetrievalPlanSchema>;

/** Deterministic executor output — computed in code, NOT by the model. */
export interface RetrievalComputedField {
  fieldKey: string;
  label: string;
  value: string | number | Array<Record<string, unknown>>;
  unit?: string;
  classification: z.infer<typeof FieldClassificationSchema>;
  provenance: ProvenanceRef[];
  constraintApplied?: string;
}
export interface RetrievalResult {
  fields: RetrievalComputedField[];
  rowSamples: Record<string, Array<{ id: string; [k: string]: unknown }>>;
}

// ── Generation → GeneratedReport ─────────────────────────────────────────────

export const ReportFigureSchema = z.object({
  fieldKey: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().nullish(),
  sourceRowIds: z.array(z.string()).describe("Row ids from the provided dataset that produced this figure."),
  derivation: z.string().nullish().describe("e.g. 'count(trips where zone=Centro and quarter=Q1)'"),
  confidence: z.number().min(0).max(1),
});
export type ReportFigure = z.infer<typeof ReportFigureSchema>;

export const GeneratedReportSchema = z.object({
  title: z.string(),
  preamble: z.string().describe("Formal opening referencing the authority, legal basis, and period."),
  sections: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      body: z.string().describe("Prose; reference figures by their fieldKey in {{braces}}."),
      figureKeys: z.array(z.string()),
    }),
  ),
  figures: z.array(ReportFigureSchema),
  closing: z.string(),
  confidence: z.number().min(0).max(1),
});
export type GeneratedReport = z.infer<typeof GeneratedReportSchema>;

// ── Extraction (B1/B2) ───────────────────────────────────────────────────────

export const ExtractedFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string().nullish().describe("Normalized string value; null if not found/illegible."),
  present: z.boolean(),
  confidence: z.number().min(0).max(1),
  note: z.string().nullish().describe("e.g. 'illegible region', 'date format ambiguous'."),
});
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;

export const ExtractionResultSchema = z.object({
  docTypeDetected: z.string(),
  fields: z.array(ExtractedFieldSchema),
  gaps: z.array(z.string()).default([]).describe("Missing required fields or illegible regions. Empty if none."),
  overallConfidence: z.number().min(0).max(1),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ── Validation self-check ────────────────────────────────────────────────────

export const SelfValidationSchema = z.object({
  checklistResults: z.array(
    z.object({
      id: z.string(),
      satisfied: z.boolean(),
      note: z.string(),
    }),
  ),
  figureFindings: z
    .array(
      z.object({
        fieldKey: z.string(),
        concern: z.string().nullish(),
      }),
    )
    .default([]),
  overallConfidence: z.number().min(0).max(1),
  blocking: z.boolean().describe("True if any unresolved discrepancy should block completion."),
});
export type SelfValidation = z.infer<typeof SelfValidationSchema>;

// ── Risk (B1/B2) ─────────────────────────────────────────────────────────────

export const RiskFactorSchema = z.object({
  factorId: z.string(),
  label: z.string(),
  contribution: z.number().describe("Points this factor adds to the 0-100 risk score."),
  evidence: z.string(),
});
export type RiskFactor = z.infer<typeof RiskFactorSchema>;

export const RiskAssessmentResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  band: RiskBandSchema,
  factors: z.array(RiskFactorSchema),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
});
export type RiskAssessmentResult = z.infer<typeof RiskAssessmentResultSchema>;

// ── Onboarding decision draft (B1) ───────────────────────────────────────────

export const OnboardingDecisionSchema = z.object({
  outcome: z.enum(["APPROVE", "APPROVE_WITH_CONDITIONS", "REJECT"]),
  conditions: z.array(z.string()).default([]),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});
export type OnboardingDecision = z.infer<typeof OnboardingDecisionSchema>;

// ── Expiry forecast & drift (B2) ─────────────────────────────────────────────

export const ExpiryForecastSchema = z.object({
  items: z.array(
    z.object({
      subject: z.string().describe("e.g. 'Vehicle WA 12345 inspection'."),
      expiresAt: z.string(),
      daysUntil: z.number().int(),
      severity: SeveritySchema,
      impact: z.string().describe("What compliance gap this opens and when."),
    }),
  ),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
});
export type ExpiryForecast = z.infer<typeof ExpiryForecastSchema>;

export const DriftReportSchema = z.object({
  items: z.array(
    z.object({
      kind: z.string().describe("e.g. 'NEW_VEHICLE_NO_REGISTRATION', 'FLEET_GROWTH', 'DOC_LAPSED'."),
      description: z.string(),
      severity: SeveritySchema,
    }),
  ),
  driftDetected: z.boolean(),
  recommendedAction: z.string(),
  confidence: z.number().min(0).max(1),
});
export type DriftReport = z.infer<typeof DriftReportSchema>;

// ── Compliance constraint decisions (§7.A) ───────────────────────────────────

export const ConstraintDecisionSchema = z.object({
  phase: z.enum(["retrieval", "generation", "output"]),
  dataClass: DataClassSchema,
  fieldKey: z.string().nullish(),
  action: ConstraintActionSchema,
  rule: z.string(),
  rationale: z.string(),
  lawfulBasis: z.string().nullish(),
});
export type ConstraintDecision = z.infer<typeof ConstraintDecisionSchema>;

export const ConstraintDecisionSetSchema = z.object({ decisions: z.array(ConstraintDecisionSchema).default([]) });
export type ConstraintDecisionSet = z.infer<typeof ConstraintDecisionSetSchema>;

// ── Explainability ───────────────────────────────────────────────────────────

export const ExplanationSchema = z.object({
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

// ── Conversational assistant ─────────────────────────────────────────────────

export const CitationSchema = z.object({
  claim: z.string(),
  sourceLabel: z.string(),
  href: z.string().nullish(),
  entity: z.string().nullish(),
  entityId: z.string().nullish(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const GroundedAnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema).default([]),
  grounded: z.boolean().describe("False if no supporting data was found — surface a caveat."),
  confidence: z.number().min(0).max(1),
});
export type GroundedAnswer = z.infer<typeof GroundedAnswerSchema>;

// ── Surface C — Regulation Intake (read → classify → synthesize → validate) ──

/** RegulationReaderAgent — decompose the uploaded regulation PDF into quotable sections. */
export const RegulationReadingSchema = z.object({
  title: z.string(),
  sourceLanguage: z.string().describe("BCP-47 of the regulation's language, e.g. 'et', 'pl', 'en'."),
  summary: z.string().describe("Plain-English summary of what this regulation governs."),
  sections: z
    .array(
      z.object({
        id: z.string().describe("Stable id, e.g. 'S1', 'art-12'."),
        heading: z.string(),
        text: z.string().describe("Verbatim/near-verbatim quotable text — the provenance source for synthesized rules."),
      }),
    )
    .describe("The regulation decomposed into quotable sections."),
  detectedCountry: z.string().nullish(),
  detectedRegulator: z.string().nullish(),
  topics: z.array(z.string()).default([]).describe("Key regulatory topics (licensing, vehicle safety, data residency, …)."),
  confidence: z.number().min(0).max(1),
});
export type RegulationReading = z.infer<typeof RegulationReadingSchema>;

/** RegulationClassifierAgent — jurisdiction + whether this is a NEW market or an UPDATE. */
export const RegulationClassificationSchema = z.object({
  country: z.string(),
  countryIso2: z.string().describe("ISO 3166-1 alpha-2, e.g. 'EE'."),
  region: RegionSchema,
  regulatorName: z.string(),
  regulatorCode: z.string(),
  privacyRegime: PrivacyRegimeSchema,
  cities: z.array(z.string()).default([]),
  currency: z.string().describe("ISO 4217, e.g. 'EUR'."),
  locale: z.string().describe("BCP-47, e.g. 'et-EE'."),
  timezone: z.string().describe("IANA tz, e.g. 'Europe/Tallinn'."),
  suggestedMarketCode: z.string().describe("UPPER_SNAKE, e.g. 'EE_TALLINN'."),
  matchesExistingMarketCode: z.string().nullish().describe("Code of an existing market this updates, or null if new."),
  isNewMarket: z.boolean(),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});
export type RegulationClassification = z.infer<typeof RegulationClassificationSchema>;

/** Per-element provenance: which regulation clause justifies a synthesized rule. */
export const RulesetProvenanceSchema = z.object({
  ref: z.string().describe("Element this supports: a docType, an authority-field key, a validation/check id, or 'policy.<area>'."),
  sourceQuote: z.string().describe("Short verbatim quote from the regulation that justifies it."),
  sectionId: z.string().nullish().describe("Id of the RegulationReading section it came from."),
  confidence: z.number().min(0).max(1),
});
export type RulesetProvenance = z.infer<typeof RulesetProvenanceSchema>;

/**
 * RulesetSynthesisAgent — the proposed MarketRuleset plus provenance and honest gaps.
 * Because `ruleset` is the real MarketRulesetSchema, callLlm's tool-parse IS the hard
 * schema gate. The agent must use ONLY the closed source/aggregation/operator vocab;
 * anything it cannot express is surfaced (not fabricated).
 */
export const RulesetSynthesisOutputSchema = z.object({
  ruleset: MarketRulesetSchema,
  provenance: z.array(RulesetProvenanceSchema).default([]),
  unmappedFields: z
    .array(z.object({ label: z.string(), reason: z.string() }))
    .default([])
    .describe("Answerable obligations with no executable source — left OUT_OF_SCOPE for a human to wire."),
  unsupportedClauses: z
    .array(z.object({ clause: z.string(), reason: z.string() }))
    .default([])
    .describe("Clauses the validation DSL cannot express — captured as manual-check notes, never fabricated."),
  summary: z.string().describe("What the ruleset captures and any judgement calls made."),
  changeNotes: z.array(z.string()).default([]).describe("For updates: what changed vs the prior version."),
  overallConfidence: z.number().min(0).max(1),
});
export type RulesetSynthesisOutput = z.infer<typeof RulesetSynthesisOutputSchema>;

/** ValidationAgent (adversarial) — quality/completeness review of the synthesized ruleset. */
export const RulesetValidationSchema = z.object({
  issues: z
    .array(z.object({ severity: SeveritySchema, ref: z.string().nullish(), message: z.string() }))
    .default([]),
  completenessNotes: z.array(z.string()).default([]).describe("Source-regulation topics the ruleset may not fully capture."),
  blocking: z.boolean().describe("True if a human must resolve issues before activation."),
  overallConfidence: z.number().min(0).max(1),
});
export type RulesetValidation = z.infer<typeof RulesetValidationSchema>;

// Re-export for convenience
export type { SourceEntity };
