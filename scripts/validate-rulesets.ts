/* Loads every market ruleset through the registry (which Zod-parses each) and prints a summary. */
import { listMarketCodes, listAllEntries } from "../engine/rules/registry";

console.log("Markets:", listMarketCodes().join(", "));
for (const e of listAllEntries()) {
  const r = e.ruleset;
  console.log(
    `  ${r.marketCode} v${r.version}  hash=${e.hash.slice(0, 12)}  docs=${r.requiredDocuments.length}  crossChecks=${r.crossDocumentChecks.length}  authorityFields=${r.authorityFields.length}  regime=${r.compliancePolicy.privacyRegime}  residency=${r.compliancePolicy.dataResidency.crossBorderTransferAllowed ? "cross-border-ok" : "restricted"}`,
  );
}
console.log("OK — all rulesets parsed against MarketRulesetSchema.");
