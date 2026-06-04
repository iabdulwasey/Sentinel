import { z } from "zod";

/**
 * Single source of truth for every status/type "enum". SQLite has no native enums,
 * so these are String columns validated by these Zod schemas. State transitions go
 * through engine/governance helpers that only accept these members.
 */

export const PRIVACY_REGIMES = ["GDPR", "NDPA", "POPIA"] as const;
export const PrivacyRegimeSchema = z.enum(PRIVACY_REGIMES);
export type PrivacyRegime = z.infer<typeof PrivacyRegimeSchema>;

export const REGIONS = ["EU", "NG", "ZA", "US", "OTHER"] as const;
export const RegionSchema = z.enum(REGIONS);
export type Region = z.infer<typeof RegionSchema>;

export const PARTNER_TYPES = ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"] as const;
export const PartnerTypeSchema = z.enum(PARTNER_TYPES);
export type PartnerType = z.infer<typeof PartnerTypeSchema>;

export const ARR_STATUSES = [
  "RECEIVED",
  "PROCESSING",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "NEEDS_CLARIFICATION",
  "DONE",
] as const;
export const ArrStatusSchema = z.enum(ARR_STATUSES);
export type ArrStatus = z.infer<typeof ArrStatusSchema>;

export const PARTNER_STATUSES = [
  "RECEIVED",
  "PROCESSING",
  "PENDING_REVIEW",
  "APPROVED",
  "CONDITIONS_APPLIED",
  "REJECTED",
  "NEEDS_CLARIFICATION",
] as const;
export const PartnerStatusSchema = z.enum(PARTNER_STATUSES);
export type PartnerStatus = z.infer<typeof PartnerStatusSchema>;

export const MONITORING_STATUSES = [
  "COMPLIANT",
  "EXPIRING_SOON",
  "DRIFT_DETECTED",
  "PENDING_REVIEW",
  "REMEDIATED",
  "CONDITIONS_APPLIED",
  "SUSPENDED_RECOMMENDED",
] as const;
export const MonitoringStatusSchema = z.enum(MONITORING_STATUSES);
export type MonitoringStatus = z.infer<typeof MonitoringStatusSchema>;

export const DOCUMENT_STATUSES = [
  "UPLOADED",
  "EXTRACTING",
  "EXTRACTED",
  "VALIDATED",
  "FLAGGED",
  "REJECTED",
] as const;
export const DocumentStatusSchema = z.enum(DOCUMENT_STATUSES);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const VALIDATION_OUTCOMES = ["PASS", "FAIL", "WARN", "NOT_APPLICABLE"] as const;
export const ValidationOutcomeSchema = z.enum(VALIDATION_OUTCOMES);
export type ValidationOutcome = z.infer<typeof ValidationOutcomeSchema>;

export const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const SeveritySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof SeveritySchema>;

export const CROSS_CHECK_OUTCOMES = ["MATCH", "MISMATCH", "INDETERMINATE"] as const;
export const CrossCheckOutcomeSchema = z.enum(CROSS_CHECK_OUTCOMES);
export type CrossCheckOutcome = z.infer<typeof CrossCheckOutcomeSchema>;

export const RISK_BANDS = ["LOW", "MEDIUM", "HIGH"] as const;
export const RiskBandSchema = z.enum(RISK_BANDS);
export type RiskBand = z.infer<typeof RiskBandSchema>;

export const FIELD_CLASSIFICATIONS = ["ANSWERABLE", "CAUTIONED", "OUT_OF_SCOPE"] as const;
export const FieldClassificationSchema = z.enum(FIELD_CLASSIFICATIONS);
export type FieldClassification = z.infer<typeof FieldClassificationSchema>;

export const PII_CLASSES = ["NONE", "PERSONAL", "SENSITIVE", "SPECIAL_CATEGORY"] as const;
export const PiiClassSchema = z.enum(PII_CLASSES);
export type PiiClass = z.infer<typeof PiiClassSchema>;

export const DATA_CLASSES = [
  "PII_DIRECT",
  "PII_SENSITIVE",
  "FINANCIAL",
  "KYC",
  "PUBLIC",
  "DERIVED_AGGREGATE",
] as const;
export const DataClassSchema = z.enum(DATA_CLASSES);
export type DataClass = z.infer<typeof DataClassSchema>;

export const CONSTRAINT_ACTIONS = ["allow", "mask", "aggregate", "omit", "block"] as const;
export const ConstraintActionSchema = z.enum(CONSTRAINT_ACTIONS);
export type ConstraintAction = z.infer<typeof ConstraintActionSchema>;

export const PIPELINE_RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "AWAITING_REVIEW",
  "COMPLETED",
  "FAILED",
] as const;
export const PipelineRunStatusSchema = z.enum(PIPELINE_RUN_STATUSES);
export type PipelineRunStatus = z.infer<typeof PipelineRunStatusSchema>;

export const PIPELINE_STAGE_STATUSES = [
  "PENDING",
  "RUNNING",
  "DONE",
  "BLOCKED",
  "FAILED",
  "SKIPPED",
] as const;
export const PipelineStageStatusSchema = z.enum(PIPELINE_STAGE_STATUSES);
export type PipelineStageStatus = z.infer<typeof PipelineStageStatusSchema>;

export const COMPLIANCE_EVENT_TYPES = [
  "STATE_CHANGE",
  "EXPIRY_FORECAST",
  "DRIFT_DETECTED",
  "RENEWAL",
  "REVALIDATION",
  "RULESET_REFLAG",
  "HUMAN_ACTION",
  "ALERT",
] as const;
export const ComplianceEventTypeSchema = z.enum(COMPLIANCE_EVENT_TYPES);
export type ComplianceEventType = z.infer<typeof ComplianceEventTypeSchema>;

export const MODEL_TIERS = ["fast", "balanced", "reasoning"] as const;
export const ModelTierSchema = z.enum(MODEL_TIERS);
export type ModelTier = z.infer<typeof ModelTierSchema>;

export const SURFACES = ["ARR", "B1", "B2", "REGINTAKE"] as const;
export const SurfaceSchema = z.enum(SURFACES);
export type Surface = z.infer<typeof SurfaceSchema>;

/** Surface C — Regulation Intake: upload a regulation → AI proposes a ruleset → human activates. */
export const REGULATION_IMPORT_STATUSES = [
  "RECEIVED",
  "PROCESSING",
  "PENDING_REVIEW",
  "ACTIVATED",
  "REJECTED",
  "NEEDS_EDIT",
  "DONE",
] as const;
export const RegulationImportStatusSchema = z.enum(REGULATION_IMPORT_STATUSES);
export type RegulationImportStatus = z.infer<typeof RegulationImportStatusSchema>;

/** How a RegulatoryRuleset row entered the DB, and whether it is the live version. */
export const RULESET_SOURCES = ["SEED", "IMPORT"] as const;
export const RulesetSourceSchema = z.enum(RULESET_SOURCES);
export type RulesetSource = z.infer<typeof RulesetSourceSchema>;

export const RULESET_STATUSES = ["ACTIVE", "SUPERSEDED"] as const;
export const RulesetStatusSchema = z.enum(RULESET_STATUSES);
export type RulesetStatus = z.infer<typeof RulesetStatusSchema>;

export const AGENT_NAMES = [
  "IntakeAgent",
  "RuleMappingAgent",
  "RetrievalPlannerAgent",
  "ExtractionAgent",
  "GenerationAgent",
  "ValidationAgent",
  "RiskAgent",
  "ExpiryForecastAgent",
  "DriftDetectionAgent",
  "ComplianceConstraintAgent",
  "ExplainAgent",
  "AssistantAgent",
  "RegulationReaderAgent",
  "RegulationClassifierAgent",
  "RulesetSynthesisAgent",
] as const;
export const AgentNameSchema = z.enum(AGENT_NAMES);
export type AgentName = z.infer<typeof AgentNameSchema>;

export const DEFECT_TYPES = [
  "NONE",
  "NAME_MISMATCH",
  "EXPIRED",
  "MISSING_FIELD",
  "LOW_LEGIBILITY",
] as const;
export const DefectTypeSchema = z.enum(DEFECT_TYPES);
export type DefectType = z.infer<typeof DefectTypeSchema>;

export const USER_ROLES = ["ADMIN", "REVIEWER"] as const;
export const UserRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof UserRoleSchema>;
