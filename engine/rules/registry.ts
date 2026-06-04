import crypto from "crypto";
import { MarketRulesetSchema, type MarketRuleset } from "../types/ruleset";
import { ALL_RULESETS } from "./markets";

/**
 * Runtime ruleset registry. Validates every market file against MarketRulesetSchema at
 * load, computes a stable contentHash (provenance + B2 ruleset-update re-flag), and serves
 * rulesets by code/version. The engine depends only on this — never on a specific market.
 */

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export interface RulesetEntry {
  ruleset: MarketRuleset;
  hash: string;
  filePath: string;
}

const registry = new Map<string, Map<number, RulesetEntry>>();

for (const raw of ALL_RULESETS) {
  const ruleset = MarketRulesetSchema.parse(raw);
  const hash = crypto.createHash("sha256").update(stableStringify(ruleset)).digest("hex");
  const filePath = `engine/rules/markets/${ruleset.marketCode}/v${ruleset.version}.ts`;
  if (!registry.has(ruleset.marketCode)) registry.set(ruleset.marketCode, new Map());
  registry.get(ruleset.marketCode)!.set(ruleset.version, { ruleset, hash, filePath });
}

export function listMarketCodes(): string[] {
  return [...registry.keys()];
}

export function latestVersion(code: string): number {
  const versions = registry.get(code);
  if (!versions) throw new Error(`Unknown market: ${code}`);
  return Math.max(...versions.keys());
}

export function getRulesetEntry(code: string, version?: number): RulesetEntry {
  const versions = registry.get(code);
  if (!versions) throw new Error(`Unknown market: ${code}`);
  const v = version ?? Math.max(...versions.keys());
  const entry = versions.get(v);
  if (!entry) throw new Error(`Unknown ruleset version: ${code} v${v}`);
  return entry;
}

export function getRuleset(code: string, version?: number): MarketRuleset {
  return getRulesetEntry(code, version).ruleset;
}

export function getContentHash(code: string, version?: number): string {
  return getRulesetEntry(code, version).hash;
}

/** All distinct (code, version) entries — used to seed RegulatoryRuleset pointer rows. */
export function listAllEntries(): RulesetEntry[] {
  const out: RulesetEntry[] = [];
  for (const versions of registry.values()) {
    for (const entry of versions.values()) out.push(entry);
  }
  return out;
}
