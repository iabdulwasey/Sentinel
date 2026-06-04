import "../surfaces/all";
import { db } from "../lib/db";
import { startPipeline, runToCompletion } from "../engine/pipeline/runner";

const KENYA_REG = `REPUBLIC OF KENYA — NATIONAL TRANSPORT AND SAFETY AUTHORITY (NTSA)
Transport Network Companies (Ride-Hailing) Regulations, 2024 — Nairobi County.

Section 1 — Scope. These rules govern digital ride-hailing operators and their drivers operating within Nairobi County zones (Westlands, CBD, Karen, Embakasi).

Section 3 — Driver requirements. Every driver MUST hold (a) a valid Kenyan Driving Licence (class B/C), and (b) a valid Public Service Vehicle (PSV) badge issued by NTSA. The PSV badge is valid for 12 months and must not be expired. Drivers must also pass a Certificate of Good Conduct (police clearance) renewed every 3 years.

Section 4 — Vehicle requirements. Each vehicle MUST have a valid annual motor-vehicle inspection certificate, a valid comprehensive insurance certificate, and current registration (logbook). Inspection is valid for 12 months.

Section 5 — Operator licensing. Companies and fleet operators must hold an NTSA TNC operator licence; individual owner-drivers are exempt from the operator licence but must register.

Section 7 — Data protection. Personal data of drivers and riders must be processed under the Kenya Data Protection Act, 2019. Driver national ID numbers and police-clearance records are sensitive and must not be disclosed to third parties without lawful basis. Personal data must be stored within Kenya unless an adequacy decision applies. Records retained for 24 months.

Section 9 — Authority reporting. On request, an operator must report: the number of active registered drivers, the number of licensed vehicles, and the total number of completed trips in a stated period and zone. Drivers' criminal-record details are NOT routinely disclosable and may only be provided under a court order.`;

async function main() {
  const imp = await db.rulesetImport.create({
    data: { reference: `REG-IMP-TEST-${Date.now() % 100000}`, rawText: KENYA_REG, fileName: "ntsa-tnc-2024.txt", status: "RECEIVED", scenarioTag: "verify" },
  });
  console.log("import:", imp.id);
  const runId = await startPipeline("REGINTAKE", imp.id);
  console.log("run:", runId, "— driving…");
  const status = await runToCompletion(runId, 12);
  console.log("run status:", status);

  const done = await db.rulesetImport.findUniqueOrThrow({ where: { id: imp.id } });
  const cls: any = done.classification;
  const wrap: any = done.draftRuleset;
  const val: any = done.validation;
  console.log("\n=== CLASSIFICATION ===");
  console.log({ country: cls?.country, region: cls?.region, regime: cls?.privacyRegime, code: done.targetMarketCode, isNew: done.isNewMarket, version: done.proposedVersion, confidence: cls?.confidence });
  console.log("\n=== DRAFT RULESET ===");
  const rs = wrap?.ruleset;
  console.log({ marketCode: rs?.marketCode, version: rs?.version, docs: rs?.requiredDocuments?.length, authorityFields: rs?.authorityFields?.length, crossChecks: rs?.crossDocumentChecks?.length, zones: rs?.zones, residencyCrossBorder: rs?.compliancePolicy?.dataResidency?.crossBorderTransferAllowed });
  console.log("documents:", rs?.requiredDocuments?.map((d: any) => d.docType));
  console.log("authorityFields:", rs?.authorityFields?.map((f: any) => `${f.key}[${f.classification}]${f.source ? ` ${f.source.aggregation}(${f.source.entity})` : ""}`));
  console.log("provenance entries:", wrap?.provenance?.length, "| unmapped:", wrap?.unmappedFields?.length, "| unsupported:", wrap?.unsupportedClauses?.length);
  console.log("\n=== VALIDATION ===");
  console.log({ schemaValid: val?.schemaValid, sourcesOk: val?.sourceCheck?.ok, blocking: val?.blocking, issues: val?.issues?.length, confidence: val?.overallConfidence });
  console.log("source issues:", JSON.stringify(val?.sourceCheck?.issues ?? []));
  console.log("\n=== COST (this run) ===");
  const calls = await db.aiCallLog.findMany({ where: { pipelineRunId: runId }, select: { agent: true, model: true, costMicroUsd: true, latencyMs: true, ok: true } });
  calls.forEach((c) => console.log(`  ${c.agent} · ${c.model.replace("claude-","")} · $${(c.costMicroUsd/1e6).toFixed(4)} · ${c.latencyMs}ms · ok=${c.ok}`));
  // cleanup the test import (don't pollute the demo list)
  await db.rulesetImport.delete({ where: { id: imp.id } });
  console.log("\n(cleaned up test import)");
  await db.$disconnect();
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
