import type { MarketRuleset } from "../types/ruleset";

/** Structural diff between two ruleset versions — drives the reviewer's "what changed" view. */
export interface RulesetDiff {
  documents: { added: string[]; removed: string[]; changed: string[] };
  authorityFields: { added: string[]; removed: string[]; changed: string[] };
  crossChecks: { added: string[]; removed: string[] };
  policyChanges: string[];
  summary: string;
}

function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
}

function diffByKey<T>(prev: T[], next: T[], key: (t: T) => string): { added: string[]; removed: string[]; changed: string[] } {
  const p = new Map(prev.map((x) => [key(x), x]));
  const n = new Map(next.map((x) => [key(x), x]));
  const added = [...n.keys()].filter((k) => !p.has(k));
  const removed = [...p.keys()].filter((k) => !n.has(k));
  const changed = [...n.keys()].filter((k) => p.has(k) && stable(p.get(k)) !== stable(n.get(k)));
  return { added, removed, changed };
}

export function diffRulesets(prev: MarketRuleset, next: MarketRuleset): RulesetDiff {
  const documents = diffByKey(prev.requiredDocuments, next.requiredDocuments, (d) => d.docType);
  const authorityFields = diffByKey(prev.authorityFields, next.authorityFields, (f) => f.key);
  const crossDoc = diffByKey(prev.crossDocumentChecks, next.crossDocumentChecks, (c) => c.id);
  const crossChecks = { added: crossDoc.added, removed: crossDoc.removed };

  const policyChanges: string[] = [];
  const pp = prev.compliancePolicy;
  const np = next.compliancePolicy;
  if (pp.privacyRegime !== np.privacyRegime) policyChanges.push(`Privacy regime ${pp.privacyRegime} → ${np.privacyRegime}`);
  if (pp.dataResidency.crossBorderTransferAllowed !== np.dataResidency.crossBorderTransferAllowed)
    policyChanges.push(`Cross-border transfer ${pp.dataResidency.crossBorderTransferAllowed ? "allowed" : "restricted"} → ${np.dataResidency.crossBorderTransferAllowed ? "allowed" : "restricted"}`);
  if (pp.retention.documentRetentionMonths !== np.retention.documentRetentionMonths)
    policyChanges.push(`Document retention ${pp.retention.documentRetentionMonths}mo → ${np.retention.documentRetentionMonths}mo`);
  if (stable(pp.purposeLimitation.restrictedDisclosureFieldKeys) !== stable(np.purposeLimitation.restrictedDisclosureFieldKeys))
    policyChanges.push("Restricted-disclosure fields changed");
  if (pp.lawfulBases.length !== np.lawfulBases.length) policyChanges.push(`Lawful bases ${pp.lawfulBases.length} → ${np.lawfulBases.length}`);

  const parts: string[] = [];
  const tally = (label: string, d: { added: string[]; removed: string[]; changed?: string[] }) => {
    const bits = [d.added.length && `+${d.added.length}`, d.removed.length && `−${d.removed.length}`, d.changed?.length && `~${d.changed.length}`].filter(Boolean);
    if (bits.length) parts.push(`${label} ${bits.join(" ")}`);
  };
  tally("documents", documents);
  tally("authority fields", authorityFields);
  tally("cross-checks", crossChecks);
  if (policyChanges.length) parts.push(`policy: ${policyChanges.length} change${policyChanges.length === 1 ? "" : "s"}`);
  const summary = parts.length ? parts.join(" · ") : "No structural changes vs the current version.";

  return { documents, authorityFields, crossChecks, policyChanges, summary };
}
