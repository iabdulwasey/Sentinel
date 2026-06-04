/**
 * §7.B confidence-gating policy — defined ONCE so "Low — review (<0.6)" means the same
 * amber-flagged thing on every surface. Higher field classes get stricter pass bars.
 */

export const CONFIDENCE_THRESHOLDS = {
  /** at/above PASS → accepted silently */
  PASS: 0.85,
  /** between REVIEW and PASS → completes but flagged for human (soft gate) */
  REVIEW: 0.6,
} as const;

/** Field sensitivity raises the pass bar (sensitive/financial fields demand higher confidence). */
export type FieldClass = "standard" | "financial" | "sensitive";

const PASS_BY_CLASS: Record<FieldClass, number> = {
  standard: CONFIDENCE_THRESHOLDS.PASS,
  financial: 0.9,
  sensitive: 0.92,
};

export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(v: number): ConfidenceBand {
  if (v >= CONFIDENCE_THRESHOLDS.PASS) return "high";
  if (v >= CONFIDENCE_THRESHOLDS.REVIEW) return "medium";
  return "low";
}

export function bandLabel(band: ConfidenceBand): string {
  return band === "high" ? "High" : band === "medium" ? "Medium" : "Low — review";
}

export type GateDecision = "pass" | "review" | "block";

/**
 * The hard gate wired into the human-in-the-loop checkpoints.
 * `unverified` (a figure that failed figure-vs-source check) or `mismatch`
 * (validation disagreement) always blocks, regardless of confidence.
 */
export function gateDecision(
  confidence: number,
  opts: { fieldClass?: FieldClass; unverified?: boolean; mismatch?: boolean } = {},
): GateDecision {
  if (opts.unverified || opts.mismatch) return "block";
  const passBar = PASS_BY_CLASS[opts.fieldClass ?? "standard"];
  if (confidence < CONFIDENCE_THRESHOLDS.REVIEW) return "block";
  if (confidence < passBar) return "review";
  return "pass";
}
