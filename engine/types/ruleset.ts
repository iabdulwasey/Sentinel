import { z } from "zod";
import {
  PrivacyRegimeSchema,
  RegionSchema,
  PartnerTypeSchema,
  SeveritySchema,
  FieldClassificationSchema,
  PiiClassSchema,
  DataClassSchema,
} from "./enums";

/**
 * The complete machine-readable contract for a market. A market = one ruleset file
 * (engine/rules/markets/<CODE>/vN.ts). The engine never references a market by name;
 * adding a market is a new ruleset + one Market seed row, with NO engine code change.
 *
 * Validations use a declarative DSL (operator + field + value) so even complex
 * per-market rules need no code. Everything here is JSON-serializable & hashable.
 */

// ── Validation DSL ───────────────────────────────────────────────────────────

export const RULE_OPERATORS = [
  "EXISTS",
  "NOT_EMPTY",
  "EQUALS",
  "NOT_EQUALS",
  "MATCHES_REGEX",
  "DATE_NOT_EXPIRED", // field date >= as-of anchor
  "DATE_WITHIN_DAYS", // field date within N days of the anchor (expiry forecast)
  "GTE",
  "LTE",
  "GT",
  "LT",
  "IN_SET",
  "CROSS_FIELD_EQUALS",
] as const;
export const RuleOperatorSchema = z.enum(RULE_OPERATORS);
export type RuleOperator = z.infer<typeof RuleOperatorSchema>;

export const ValidationRuleSchema = z.object({
  id: z.string(), // namespaced, e.g. "EE.OPERATOR_LICENSE.NOT_EXPIRED"
  description: z.string(),
  field: z.string(), // dotted path into extractedFields
  operator: RuleOperatorSchema,
  value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
  compareField: z.string().optional(),
  severity: SeveritySchema,
  failMessage: z.string(),
  lawfulBasisTag: z.string().optional(),
});
export type ValidationRule = z.infer<typeof ValidationRuleSchema>;

// ── Required documents ───────────────────────────────────────────────────────

export const ExpectedFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["string", "number", "date", "boolean"]),
  piiClass: PiiClassSchema.optional(),
  required: z.boolean().default(true),
  example: z.string().optional(),
});
export type ExpectedField = z.infer<typeof ExpectedFieldSchema>;

export const RequiredDocumentSpecSchema = z.object({
  docType: z.string(),
  label: z.string(),
  requiredFor: z.array(PartnerTypeSchema),
  optional: z.boolean().default(false),
  expectedFields: z.array(ExpectedFieldSchema),
  validations: z.array(ValidationRuleSchema),
  validityMonths: z.number().int().positive().optional(),
});
export type RequiredDocumentSpec = z.infer<typeof RequiredDocumentSpecSchema>;

export const CrossDocumentCheckSchema = z.object({
  id: z.string(),
  description: z.string(),
  docTypeA: z.string(),
  docTypeB: z.string(),
  fieldA: z.string(),
  fieldB: z.string(),
  operator: z.enum(["CROSS_FIELD_EQUALS", "MATCHES_REGEX"]),
  severity: SeveritySchema,
  failMessage: z.string(),
});
export type CrossDocumentCheck = z.infer<typeof CrossDocumentCheckSchema>;

// ── Authority-request answerable fields ──────────────────────────────────────

export const SOURCE_ENTITIES = ["Trip", "Driver", "Vehicle", "Document", "FleetPartner"] as const;
export const SourceEntitySchema = z.enum(SOURCE_ENTITIES);
export type SourceEntity = z.infer<typeof SourceEntitySchema>;

export const AGGREGATIONS = ["count", "sum", "avg", "list", "max", "min"] as const;
export const AggregationSchema = z.enum(AGGREGATIONS);
export type Aggregation = z.infer<typeof AggregationSchema>;

export const AnswerableFieldSourceSchema = z.object({
  entity: SourceEntitySchema,
  aggregation: AggregationSchema,
  field: z.string().optional(), // for sum/avg/list-of-field
  filterRuleIds: z.array(z.string()).optional(), // named filters below
});
export type AnswerableFieldSource = z.infer<typeof AnswerableFieldSourceSchema>;

export const AnswerableFieldSpecSchema = z.object({
  key: z.string(),
  label: z.string(),
  classification: FieldClassificationSchema,
  description: z.string(),
  dataClass: DataClassSchema,
  source: AnswerableFieldSourceSchema.optional(),
  cautionNote: z.string().optional(),
  lawfulBasisTag: z.string().optional(),
});
export type AnswerableFieldSpec = z.infer<typeof AnswerableFieldSpecSchema>;

export const NamedFilterSchema = z.object({
  description: z.string(),
  field: z.string(),
  operator: RuleOperatorSchema,
  value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
});
export type NamedFilter = z.infer<typeof NamedFilterSchema>;

// ── Mandated report format ───────────────────────────────────────────────────

export const ReportFormatSpecSchema = z.object({
  formatId: z.string(),
  mandatedBy: z.string(),
  delivery: z.enum(["PDF", "STRUCTURED_JSON", "BOTH"]),
  sections: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      fieldKeys: z.array(z.string()),
      required: z.boolean().default(true),
    }),
  ),
  header: z.object({ logoText: z.string().optional(), legalNotice: z.string().optional() }).optional(),
  footer: z.object({ signatureBlock: z.boolean().optional(), legalNotice: z.string().optional() }).optional(),
  dateFormat: z.string(), // "DD.MM.YYYY" | "YYYY-MM-DD" | "DD/MM/YYYY"
  numberFormat: z.object({ decimal: z.string(), thousands: z.string() }),
  language: z.string(), // BCP-47
});
export type ReportFormatSpec = z.infer<typeof ReportFormatSpecSchema>;

// ── Compliance policy (§7.A) ─────────────────────────────────────────────────

export const CompliancePolicySchema = z.object({
  privacyRegime: PrivacyRegimeSchema,
  dataResidency: z.object({
    storageRegion: RegionSchema,
    crossBorderTransferAllowed: z.boolean(),
    allowedTransferRegions: z.array(RegionSchema),
    note: z.string(),
  }),
  piiClassification: z.array(z.object({ fieldKey: z.string(), piiClass: PiiClassSchema })),
  lawfulBases: z.array(
    z.object({
      tag: z.string(),
      label: z.string(),
      appliesToFieldKeys: z.array(z.string()),
    }),
  ),
  purposeLimitation: z.object({
    declaredPurposes: z.array(z.string()),
    restrictedDisclosureFieldKeys: z.array(z.string()),
  }),
  retention: z.object({
    documentRetentionMonths: z.number().int().positive(),
    auditLogRetentionMonths: z.number().int().positive(),
    autoPurgeAfterRetention: z.boolean(),
  }),
});
export type CompliancePolicy = z.infer<typeof CompliancePolicySchema>;

// ── Risk model ───────────────────────────────────────────────────────────────

export const RiskModelSchema = z.object({
  factors: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      weight: z.number(),
      deriveFrom: z.string(), // describes the signal (for the explain layer)
    }),
  ),
  bands: z.object({
    low: z.tuple([z.number(), z.number()]),
    medium: z.tuple([z.number(), z.number()]),
    high: z.tuple([z.number(), z.number()]),
  }),
});
export type RiskModel = z.infer<typeof RiskModelSchema>;

// ── The ruleset ──────────────────────────────────────────────────────────────

export const MarketRulesetSchema = z.object({
  marketCode: z.string(),
  version: z.number().int().positive(),
  country: z.string(),
  regulator: z.object({ name: z.string(), code: z.string(), website: z.string().optional() }),
  region: RegionSchema,
  timezone: z.string(),
  currency: z.string(),
  locale: z.string(),
  zones: z.array(z.string()), // districts/zones for synthetic data + ARR filters
  requiredDocuments: z.array(RequiredDocumentSpecSchema),
  crossDocumentChecks: z.array(CrossDocumentCheckSchema),
  authorityFields: z.array(AnswerableFieldSpecSchema),
  reportFormat: ReportFormatSpecSchema,
  compliancePolicy: CompliancePolicySchema,
  namedFilters: z.record(z.string(), NamedFilterSchema).optional(),
  riskModel: RiskModelSchema,
});
export type MarketRuleset = z.infer<typeof MarketRulesetSchema>;
/** Input (authoring) type — fields with Zod defaults may be omitted; the registry parses to MarketRuleset. */
export type MarketRulesetInput = z.input<typeof MarketRulesetSchema>;

/** Authoring helper — gives editor autocomplete; the registry Zod-parses to the resolved MarketRuleset. */
export function defineRuleset(r: MarketRulesetInput): MarketRulesetInput {
  return r;
}
