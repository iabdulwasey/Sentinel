import type { ModelTier } from "../types/enums";

export type ModelId = "claude-haiku-4-5-20251001" | "claude-sonnet-4-6" | "claude-opus-4-8";

export const MODEL_BY_TIER: Record<ModelTier, ModelId> = {
  fast: "claude-haiku-4-5-20251001",
  balanced: "claude-sonnet-4-6",
  reasoning: "claude-opus-4-8",
};

/** USD per 1M tokens. cacheRead is the discounted hit rate; cacheWrite is the 5-min write rate. */
export const RATE_CARD: Record<ModelId, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-opus-4-8": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Cost in integer micro-USD (avoids float drift; matches the AiCallLog Int column). */
export function computeCostMicroUsd(model: ModelId, usage: TokenUsage): number {
  const r = RATE_CARD[model] ?? RATE_CARD["claude-sonnet-4-6"];
  const usd =
    (usage.inputTokens * r.input +
      usage.outputTokens * r.output +
      usage.cacheWriteTokens * r.cacheWrite +
      usage.cacheReadTokens * r.cacheRead) /
    1_000_000;
  return Math.round(usd * 1_000_000);
}

/** Per-tier timeouts (ms) — reasoning over big PDFs needs longer. */
export const TIER_TIMEOUT_MS: Record<ModelTier, number> = {
  fast: 45_000,
  balanced: 90_000,
  reasoning: 150_000,
};
