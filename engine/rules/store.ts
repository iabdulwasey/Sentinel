import crypto from "crypto";
import { db } from "../../lib/db";
import { MarketRulesetSchema, type MarketRuleset } from "../types/ruleset";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Stable content hash for a ruleset (provenance + the B2 ruleset-update re-flag). */
export function hashRuleset(rs: MarketRuleset): string {
  return crypto.createHash("sha256").update(stableStringify(rs)).digest("hex");
}

/**
 * Runtime ruleset resolver — the DB is the single source of truth for all rules.
 *
 * Every RegulatoryRuleset row carries the full, Zod-validated MarketRuleset in `content`
 * (seeded from code for the built-in markets; AI-authored for imports). Nothing in the
 * request path reads code files; `engine/rules/registry.ts` is now only the SEED source.
 *
 * Caching: a given (market, version)'s content is immutable — changing rules creates a NEW
 * version — so parsed rulesets are cached by `code:version`. The mutable bit is *which*
 * version is active (Market.activeRulesetVersion), which we always read fresh.
 */

export interface ResolvedRuleset {
  ruleset: MarketRuleset;
  hash: string;
  version: number;
  source: string; // SEED | IMPORT
  status: string; // ACTIVE | SUPERSEDED
}

const cache = new Map<string, ResolvedRuleset>();

export async function resolveRulesetEntry(code: string, version?: number): Promise<ResolvedRuleset> {
  const market = await db.market.findUnique({ where: { code }, select: { id: true, activeRulesetVersion: true } });
  if (!market) throw new Error(`Unknown market: ${code}`);
  const v = version ?? market.activeRulesetVersion;
  const key = `${code}:${v}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const row = await db.regulatoryRuleset.findFirst({ where: { marketId: market.id, version: v } });
  if (!row) throw new Error(`Unknown ruleset version: ${code} v${v}`);
  if (!row.content) throw new Error(`Ruleset ${code} v${v} has no DB content — run the seed/backfill so the DB holds the rules.`);

  const ruleset = MarketRulesetSchema.parse(row.content);
  const entry: ResolvedRuleset = { ruleset, hash: row.contentHash, version: v, source: row.source, status: row.status };
  cache.set(key, entry);
  return entry;
}

export async function resolveRuleset(code: string, version?: number): Promise<MarketRuleset> {
  return (await resolveRulesetEntry(code, version)).ruleset;
}

export async function resolveContentHash(code: string, version?: number): Promise<string> {
  return (await resolveRulesetEntry(code, version)).hash;
}

/** Drop cached entries (call after activating a new ruleset version so reads pick it up). */
export function invalidateRulesetCache(code?: string): void {
  if (!code) {
    cache.clear();
    return;
  }
  for (const k of [...cache.keys()]) if (k.startsWith(`${code}:`)) cache.delete(k);
}
