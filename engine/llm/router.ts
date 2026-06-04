import type { AgentName, ModelTier } from "../types/enums";
import { MODEL_BY_TIER, type ModelId } from "./models";

/**
 * Model-routing policy. Reasoning tier for legal interpretation, document extraction,
 * generation, and self-validation; balanced for structured mapping/scoring/assistant;
 * fast for date-heavy forecasting. Centralized so cost/latency posture is tunable here.
 */
const BASE_TIER: Record<AgentName, ModelTier> = {
  IntakeAgent: "balanced",
  RuleMappingAgent: "reasoning",
  RetrievalPlannerAgent: "balanced",
  ExtractionAgent: "reasoning",
  GenerationAgent: "reasoning",
  ValidationAgent: "reasoning",
  RiskAgent: "balanced",
  ExpiryForecastAgent: "fast",
  DriftDetectionAgent: "balanced",
  ComplianceConstraintAgent: "reasoning",
  ExplainAgent: "balanced",
  AssistantAgent: "balanced",
  // Surface C — Regulation Intake. Reading + synthesis are reasoning (extraction errors and
  // malformed rules poison every downstream surface); classification is balanced.
  RegulationReaderAgent: "reasoning",
  RegulationClassifierAgent: "balanced",
  RulesetSynthesisAgent: "reasoning",
};

export interface RouteHints {
  /** escalate to the reasoning tier (e.g. assistant multi-hop, low-confidence re-extraction) */
  escalate?: boolean;
}

export function routeTier(agent: AgentName, hints?: RouteHints): ModelTier {
  const base = BASE_TIER[agent] ?? "balanced";
  if (hints?.escalate && base !== "reasoning") {
    return base === "fast" ? "balanced" : "reasoning";
  }
  return base;
}

export function routeModel(agent: AgentName, hints?: RouteHints, override?: ModelId): ModelId {
  if (override) return override;
  return MODEL_BY_TIER[routeTier(agent, hints)];
}
