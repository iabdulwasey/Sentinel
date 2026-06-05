/**
 * Resets seeded partners that were created as APPROVED without ever running
 * the B1 pipeline. Removes any backfilled/fake artifacts and sets them back to
 * RECEIVED so the pipeline stepper appears and real AI data can be produced.
 *
 *   npx tsx scripts/reset-unprocessed-partners.ts
 */
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";

async function main() {
  // Partners that have no pipeline run at all — never processed
  const unprocessed = await db.fleetPartner.findMany({
    where: {
      deletedAt: null,
      status: { in: ["APPROVED", "CONDITIONS_APPLIED", "REJECTED"] },
      pipelineRuns: { none: {} },
    },
    select: { id: true, reference: true, status: true },
  });

  console.log(`Resetting ${unprocessed.length} unprocessed partners to RECEIVED…`);

  for (const p of unprocessed) {
    // Remove any fake/backfilled artifacts
    await db.validation.deleteMany({ where: { partnerId: p.id } });
    await db.crossCheck.deleteMany({ where: { partnerId: p.id } });
    await db.riskAssessment.deleteMany({ where: { partnerId: p.id } });
    await db.complianceEvent.deleteMany({ where: { partnerId: p.id, type: { notIn: ["ONBOARDED", "RULESET_UPDATED"] } } });
    await db.partnerHistory.deleteMany({ where: { partnerId: p.id } });

    // Reset to RECEIVED — pipeline stepper will show, real AI run can start
    await db.fleetPartner.update({
      where: { id: p.id },
      data: {
        status: "RECEIVED",
        decision: Prisma.DbNull,
        riskScore: null,
        riskBand: null,
        onboardedAt: null,
        monitoringStatus: "COMPLIANT",
        monitoringReason: null,
        lastAssessedAt: null,
        lastAssessedRulesetVersion: null,
        aiElapsedMs: null,
      },
    });
    console.log(`  ✓ ${p.reference} (was ${p.status}) → RECEIVED`);
  }

  console.log(`Done.`);
  process.exit(0);
}

main();
