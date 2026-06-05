/**
 * Restores the compliance monitoring portfolio to a meaningful demo state:
 * 1. B2 scenario partners → restored to their specific APPROVED + scenario monitoring status
 * 2. Bulk historical partners → APPROVED + COMPLIANT (they represent the existing fleet)
 * 3. ~8 partners kept as RECEIVED for the B1 onboarding demo
 *
 *   npx tsx scripts/restore-monitoring-portfolio.ts
 */
import { db } from "../lib/db";

// Which scenario partners need which monitoring status
const B2_RESTORE: Record<string, { monitoringStatus: string; monitoringReason: string | null; riskScore?: number; riskBand?: string }> = {
  "b2-expiring":  { monitoringStatus: "EXPIRING_SOON",    monitoringReason: "2 vehicle inspections lapse within 21 days", riskScore: 38, riskBand: "MEDIUM" },
  "b2-drift":     { monitoringStatus: "DRIFT_DETECTED",   monitoringReason: "2 vehicles added without valid registration", riskScore: 64, riskBand: "MEDIUM" },
  "b2-renewal":   { monitoringStatus: "EXPIRING_SOON",    monitoringReason: "Insurance expiring in 10 days; renewed document submitted", riskScore: 47, riskBand: "MEDIUM" },
  "b2-reflag":    { monitoringStatus: "COMPLIANT",        monitoringReason: null },
};

async function main() {
  // 1. Restore B2 scenario partners
  const b2Partners = await db.fleetPartner.findMany({
    where: { scenarioTag: { startsWith: "b2" }, deletedAt: null },
    select: { id: true, reference: true, scenarioTag: true, status: true },
  });

  console.log(`Restoring ${b2Partners.length} B2 scenario partners…`);
  for (const p of b2Partners) {
    const cfg = B2_RESTORE[p.scenarioTag ?? ""] ?? { monitoringStatus: "COMPLIANT", monitoringReason: null };
    await db.fleetPartner.update({
      where: { id: p.id },
      data: {
        status: "APPROVED",
        monitoringStatus: cfg.monitoringStatus,
        monitoringReason: cfg.monitoringReason,
        riskScore: cfg.riskScore ?? undefined,
        riskBand: cfg.riskBand ?? undefined,
        onboardedAt: new Date("2025-10-01"),
        lastAssessedAt: new Date("2026-05-01"),
        lastAssessedRulesetVersion: 1,
      },
    });
    console.log(`  ✓ ${p.reference} (${p.scenarioTag}) → APPROVED / ${cfg.monitoringStatus}`);
  }

  // 2. Restore bulk RECEIVED (non-scenario) partners to APPROVED + COMPLIANT
  //    Keep 8 partners as RECEIVED for the B1 onboarding demo (2 per market)
  const nonScenario = await db.fleetPartner.findMany({
    where: { deletedAt: null, scenarioTag: null, status: "RECEIVED" },
    include: { market: true },
    orderBy: { reference: "asc" },
  });

  // Keep 2 RECEIVED per market code for the demo
  const keepReceived = new Set<string>();
  const countByMarket: Record<string, number> = {};
  for (const p of nonScenario) {
    const code = p.market.code;
    countByMarket[code] = (countByMarket[code] ?? 0) + 1;
    if (countByMarket[code] <= 2) keepReceived.add(p.id);
  }

  const toApprove = nonScenario.filter((p) => !keepReceived.has(p.id));
  console.log(`\nRestoring ${toApprove.length} bulk partners to APPROVED + COMPLIANT (keeping ${keepReceived.size} as RECEIVED for B1 demo)…`);

  // Give a realistic risk distribution: ~70% LOW, 20% MEDIUM, 10% HIGH
  const bands = (i: number): { riskScore: number; riskBand: string } => {
    const mod = i % 10;
    if (mod >= 9) return { riskScore: 65 + (i % 20),  riskBand: "HIGH" };
    if (mod >= 7) return { riskScore: 40 + (i % 25),  riskBand: "MEDIUM" };
    return          { riskScore: 5  + (i % 30),  riskBand: "LOW" };
  };

  // Give a realistic monitoring distribution: mostly COMPLIANT, a few EXPIRING_SOON
  const monStatus = (i: number): string => {
    if (i % 12 === 0) return "EXPIRING_SOON";
    return "COMPLIANT";
  };

  for (let i = 0; i < toApprove.length; i++) {
    const p = toApprove[i];
    const { riskScore, riskBand } = bands(i);
    const monitoringStatus = monStatus(i);
    await db.fleetPartner.update({
      where: { id: p.id },
      data: {
        status: "APPROVED",
        monitoringStatus,
        monitoringReason: monitoringStatus === "EXPIRING_SOON" ? "One or more vehicle documents expiring within 30 days." : null,
        riskScore,
        riskBand,
        onboardedAt: new Date(2025, Math.floor(i % 12), 1 + (i % 28)),
        lastAssessedAt: new Date("2026-05-15"),
        lastAssessedRulesetVersion: 1,
      },
    });
  }
  console.log("  ✓ done");

  // Summary
  const summary = await db.fleetPartner.groupBy({ by: ["status"], _count: { id: true }, where: { deletedAt: null } });
  const mon = await db.fleetPartner.groupBy({ by: ["monitoringStatus"], _count: { id: true }, where: { deletedAt: null, status: { in: ["APPROVED", "CONDITIONS_APPLIED"] } } });
  console.log("\nFinal state:");
  console.log("  onboarding:", JSON.stringify(summary.map(s => `${s.status}:${s._count.id}`)));
  console.log("  monitoring:", JSON.stringify(mon.map(s => `${s.monitoringStatus}:${s._count.id}`)));
  process.exit(0);
}

main();
