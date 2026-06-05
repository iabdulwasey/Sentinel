/**
 * Prepares the full demo state:
 * 1. Resets ALL partners to RECEIVED (clean slate, all pipeline artifacts cleared)
 * 2. Sets vehicle/document dates on designated partners so the B2 sweep
 *    naturally detects EXPIRING_SOON, DRIFT_DETECTED, and RULESET_REFLAG issues
 *    once the user runs B1 pipeline for all partners → approves → runs B2 sweep.
 *
 *   npx tsx scripts/prepare-full-demo.ts
 */
import { addDays } from "date-fns";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import { SEED_ANCHOR } from "../prisma/seed-lib/dates";

const ANCHOR = SEED_ANCHOR;

async function main() {
  console.log("Step 1: Reset ALL partners to RECEIVED + clear pipeline artifacts…");

  const partners = await db.fleetPartner.findMany({
    where: { deletedAt: null },
    select: { id: true, reference: true, scenarioTag: true, marketId: true },
  });

  // Clear all pipeline artifacts for all partners
  const ids = partners.map((p) => p.id);
  await db.pipelineStage.deleteMany({ where: { run: { partnerId: { in: ids } } } });
  await db.pipelineRun.deleteMany({ where: { partnerId: { in: ids } } });
  await db.validation.deleteMany({ where: { partnerId: { in: ids } } });
  await db.crossCheck.deleteMany({ where: { partnerId: { in: ids } } });
  await db.riskAssessment.deleteMany({ where: { partnerId: { in: ids } } });
  await db.complianceEvent.deleteMany({ where: { partnerId: { in: ids } } });
  await db.partnerHistory.deleteMany({ where: { partnerId: { in: ids } } });
  console.log(`  Cleared artifacts for ${ids.length} partners`);

  // Reset all to RECEIVED
  await db.fleetPartner.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "RECEIVED",
      monitoringStatus: "COMPLIANT",
      monitoringReason: null,
      decision: Prisma.DbNull,
      riskScore: null,
      riskBand: null,
      onboardedAt: null,
      lastAssessedAt: null,
      lastAssessedRulesetVersion: null,
      aiElapsedMs: null,
    },
  });
  console.log(`  All ${ids.length} partners → RECEIVED`);

  // ── Step 2: Set up compliance-issue data ─────────────────────────────────
  console.log("\nStep 2: Injecting compliance-issue data into vehicles/documents…");

  // Designate 2 partners per market for EXPIRING_SOON (vehicle inspection/insurance due in 14-21 days)
  // and 2 partners for DRIFT_DETECTED (recently-added vehicles with bad registration)
  // These are plain non-scenario partners picked from each market.

  const EXPIRING: Record<string, string[]> = {
    EE_TALLINN:      ["FP-EE-0003", "FP-EE-0004"],
    PL_WARSAW:       ["FP-PL-0006", "FP-PL-0007"],
    PT_LISBON:       ["FP-PT-0011", "FP-PT-0012"],
    RO_BUCHAREST:    ["FP-RO-0016", "FP-RO-0017"],
    NG_LAGOS:        ["FP-NG-0021", "FP-NG-0022"],
    ZA_JOHANNESBURG: ["FP-ZA-0026", "FP-ZA-0027"],
  };
  const DRIFT: Record<string, string[]> = {
    EE_TALLINN:      ["FP-EE-0005"],
    PL_WARSAW:       ["FP-PL-0008"],
    PT_LISBON:       ["FP-PT-0013"],
    RO_BUCHAREST:    ["FP-RO-0018"],
    NG_LAGOS:        ["FP-NG-0023"],
    ZA_JOHANNESBURG: ["FP-ZA-0028"],
  };

  const allExpiring = Object.values(EXPIRING).flat();
  const allDrift    = Object.values(DRIFT).flat();

  // EXPIRING_SOON: set 1 vehicle's inspectionValidUntil to 14 days from anchor
  //               and another's insuranceValidUntil to 21 days from anchor
  for (const ref of allExpiring) {
    const p = partners.find((x) => x.reference === ref);
    if (!p) continue;
    const vehicles = await db.vehicle.findMany({ where: { partnerId: p.id }, take: 2 });
    if (vehicles[0]) {
      await db.vehicle.update({ where: { id: vehicles[0].id }, data: { inspectionValidUntil: addDays(ANCHOR, 14) } });
    }
    if (vehicles[1]) {
      await db.vehicle.update({ where: { id: vehicles[1].id }, data: { insuranceValidUntil: addDays(ANCHOR, 21) } });
    }
    // Also set the corresponding document expiry
    await db.document.updateMany({
      where: { partnerId: p.id, docType: { in: ["VEHICLE_INSPECTION", "VEHICLE_ITP", "VEHICLE_ROADWORTHINESS"] } },
      data: { expiresAt: addDays(ANCHOR, 14) },
    });
    await db.document.updateMany({
      where: { partnerId: p.id, docType: "VEHICLE_INSURANCE" },
      data: { expiresAt: addDays(ANCHOR, 21) },
    });
    console.log(`  EXPIRING: ${ref} — vehicles set to expire in 14/21 days`);
  }

  // DRIFT_DETECTED: add a vehicle with addedAt = 3 days ago and registrationValidUntil = expired
  for (const ref of allDrift) {
    const p = partners.find((x) => x.reference === ref);
    if (!p) continue;
    // Mark an existing vehicle as recently added with expired registration
    const v = await db.vehicle.findFirst({ where: { partnerId: p.id } });
    if (v) {
      await db.vehicle.update({
        where: { id: v.id },
        data: {
          addedAt: addDays(ANCHOR, -3),
          registrationValidUntil: addDays(ANCHOR, -30), // expired
        },
      });
    }
    console.log(`  DRIFT:    ${ref} — vehicle added recently with expired registration`);
  }

  // B2 scenario partners: ensure their specific data is preserved/reinforced
  // b2-expiring (FP-EE-0035): 2 vehicles with inspections due in 21 days
  const expiring = partners.find((p) => p.scenarioTag === "b2-expiring");
  if (expiring) {
    const vs = await db.vehicle.findMany({ where: { partnerId: expiring.id }, take: 2 });
    for (const v of vs) {
      await db.vehicle.update({ where: { id: v.id }, data: { inspectionValidUntil: addDays(ANCHOR, 21) } });
    }
    console.log(`  B2-EXPIRING: FP-EE-0035 vehicles set to expire in 21 days`);
  }

  // b2-drift (FP-EE-0036): 2 vehicles added recently with expired registration
  const drift = partners.find((p) => p.scenarioTag === "b2-drift");
  if (drift) {
    const vs = await db.vehicle.findMany({ where: { partnerId: drift.id }, take: 2 });
    for (const v of vs) {
      await db.vehicle.update({ where: { id: v.id }, data: { addedAt: addDays(ANCHOR, -5), registrationValidUntil: addDays(ANCHOR, -30) } });
    }
    console.log(`  B2-DRIFT:    FP-EE-0036 vehicles marked as recent additions with expired registration`);
  }

  // b2-renewal (FP-PL-0037): insurance expiring in 10 days
  const renewal = partners.find((p) => p.scenarioTag === "b2-renewal");
  if (renewal) {
    const vs = await db.vehicle.findMany({ where: { partnerId: renewal.id }, take: 1 });
    if (vs[0]) await db.vehicle.update({ where: { id: vs[0].id }, data: { insuranceValidUntil: addDays(ANCHOR, 10) } });
    await db.document.updateMany({ where: { partnerId: renewal.id, docType: "VEHICLE_INSURANCE" }, data: { expiresAt: addDays(ANCHOR, 10) } });
    console.log(`  B2-RENEWAL:  FP-PL-0037 insurance set to expire in 10 days`);
  }

  console.log("\n✓ Done. All 37 partners are RECEIVED with compliance-issue data injected.");
  console.log("\nNext steps:");
  console.log("  1. Open http://localhost:3010/fleet-onboarding");
  console.log("  2. Click each partner → Run onboarding pipeline → wait → Approve");
  console.log("  3. Once all approved, click 'Run monitoring sweep' on the Compliance Monitoring page");
  console.log("  4. The sweep will detect expiry/drift issues and populate the monitoring page.");
  process.exit(0);
}

main();
