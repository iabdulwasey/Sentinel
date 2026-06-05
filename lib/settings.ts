import { z } from "zod";
import { db } from "./db";
import { MODEL_BY_TIER } from "@/engine/llm/models";
import { CONFIDENCE_THRESHOLDS } from "@/lib/confidence";

/**
 * Org settings, persisted as a single JSON document in AppMeta (key "settings"). The Anthropic
 * API key override is stored under a SEPARATE key ("secret.anthropicKey") so it is never
 * serialized into the client-facing settings payload. getSettings() deep-merges over defaults
 * (so adding a field is backwards-compatible) and is cached in-process; saving invalidates it.
 *
 * "Nothing fake": settings here are either (a) enforced (API key, prompt caching, theme, team),
 * (b) the configuration-of-record presented in the UI, or (c) reflections of real runtime state.
 */

const MODEL_IDS = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-8"] as const;

export const SettingsSchema = z.object({
  general: z.object({
    workspaceName: z.string().default("Bolt Sentinel"),
    defaultMarket: z.string().default("ALL"),
    manualBaselineHours: z.number().min(0).max(80).default(4),
  }),
  ai: z.object({
    promptCaching: z.boolean().default(true),
    tiers: z.object({
      fast: z.enum(MODEL_IDS).default(MODEL_BY_TIER.fast),
      balanced: z.enum(MODEL_IDS).default(MODEL_BY_TIER.balanced),
      reasoning: z.enum(MODEL_IDS).default(MODEL_BY_TIER.reasoning),
    }),
    monthlyBudgetUsd: z.number().min(0).nullable().default(250),
  }),
  accuracy: z.object({
    passThreshold: z.number().min(0).max(1).default(CONFIDENCE_THRESHOLDS.PASS),
    reviewThreshold: z.number().min(0).max(1).default(CONFIDENCE_THRESHOLDS.REVIEW),
    financialThreshold: z.number().min(0).max(1).default(0.9),
    sensitiveThreshold: z.number().min(0).max(1).default(0.92),
    blockOnUnverifiedFigure: z.boolean().default(true),
    blockOnValidationMismatch: z.boolean().default(true),
  }),
  approvals: z.object({
    dualApprovalForArrExport: z.boolean().default(false),
    dualApprovalForPartnerReject: z.boolean().default(false),
    dualApprovalForSuspension: z.boolean().default(true),
    autoRouteBelowConfidence: z.boolean().default(true),
  }),
  compliance: z.object({
    blockCrossBorderByDefault: z.boolean().default(true),
    documentRetentionMonths: z.number().int().min(1).max(240).default(60),
    auditRetentionMonths: z.number().int().min(1).max(240).default(84),
    autoPurgeAfterRetention: z.boolean().default(false),
  }),
  connectors: z.object({
    arrIntakeChannels: z.array(z.string()).default(["manual", "email", "webhook"]),
    onboardingIntakeChannels: z.array(z.string()).default(["manual", "portal", "webhook"]),
    inboundWebhookEnabled: z.boolean().default(false),
    apiTokens: z
      .array(z.object({ id: z.string(), label: z.string(), preview: z.string(), createdAt: z.string() }))
      .default([]),
  }),
  notifications: z.object({
    triggers: z.object({
      expiryForecast: z.boolean().default(true),
      driftDetected: z.boolean().default(true),
      pendingReview: z.boolean().default(true),
      slaBreach: z.boolean().default(true),
      rulesetReflag: z.boolean().default(true),
      lowConfidenceBlock: z.boolean().default(true),
    }),
    inApp: z.boolean().default(true),
    emailEnabled: z.boolean().default(false),
    emailAddress: z.string().default(""),
    outboundWebhookEnabled: z.boolean().default(false),
    outboundWebhookUrl: z.string().default(""),
  }),
  security: z.object({
    sessionTimeoutHours: z.number().int().min(1).max(720).default(72),
  }),
});

export type Settings = z.infer<typeof SettingsSchema>;

const SETTINGS_KEY = "settings";
const SECRET_KEY = "secret.anthropicKey";

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({
  general: {},
  ai: { tiers: {} },
  accuracy: {},
  approvals: {},
  compliance: {},
  connectors: {},
  notifications: { triggers: {} },
  security: {},
});

let _cache: Settings | null = null;
let _secretCache: { v: string | null } | null = null;

function deepMerge<T>(base: T, over: unknown): T {
  if (over === null || over === undefined) return base;
  if (typeof base !== "object" || Array.isArray(base) || typeof over !== "object" || Array.isArray(over)) return over as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    out[k] = k in (base as Record<string, unknown>) ? deepMerge((base as Record<string, unknown>)[k], v) : v;
  }
  return out as T;
}

export async function getSettings(): Promise<Settings> {
  if (_cache) return _cache;
  const row = await db.appMeta.findUnique({ where: { key: SETTINGS_KEY } });
  const merged = deepMerge(DEFAULT_SETTINGS, row?.value ?? {});
  const parsed = SettingsSchema.safeParse(merged);
  _cache = parsed.success ? parsed.data : DEFAULT_SETTINGS;
  return _cache;
}

export async function saveSettings(next: Settings): Promise<Settings> {
  const parsed = SettingsSchema.parse(next);
  await db.appMeta.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value: parsed as object }, update: { value: parsed as object } });
  _cache = parsed;
  return parsed;
}

/** Resolve the active Anthropic key: a settings override wins over the env var. */
export async function getAnthropicKey(): Promise<{ key: string | null; source: "override" | "env" | "none"; last4: string | null }> {
  if (!_secretCache) {
    const row = await db.appMeta.findUnique({ where: { key: SECRET_KEY } });
    const v = (row?.value as { key?: string } | null)?.key ?? null;
    _secretCache = { v };
  }
  const override = _secretCache.v;
  if (override) return { key: override, source: "override", last4: override.slice(-4) };
  const env = process.env.ANTHROPIC_API_KEY ?? null;
  if (env) return { key: env, source: "env", last4: env.slice(-4) };
  return { key: null, source: "none", last4: null };
}

export async function setAnthropicKey(key: string | null): Promise<void> {
  if (key && key.trim()) {
    await db.appMeta.upsert({ where: { key: SECRET_KEY }, create: { key: SECRET_KEY, value: { key: key.trim() } }, update: { value: { key: key.trim() } } });
  } else {
    await db.appMeta.deleteMany({ where: { key: SECRET_KEY } });
  }
  _secretCache = null;
}

export function invalidateSettingsCache(): void {
  _cache = null;
  _secretCache = null;
}
