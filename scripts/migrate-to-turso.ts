/**
 * Migrates ALL data from local SQLite (prisma/dev.db) to Turso.
 * Uses two separate Prisma clients so column mapping is handled correctly.
 *
 *   npx tsx scripts/migrate-to-turso.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import * as fs from "fs";

// ── Source: local SQLite ──────────────────────────────────────────────────
// Force DATABASE_URL to the local file before Prisma client initializes
process.env.DATABASE_URL = "file:/Users/abdul/Desktop/Sentinel/prisma/dev.db";
process.env.TURSO_DATABASE_URL = ""; // clear so local client uses SQLite
const local = new PrismaClient();

// ── Destination: Turso ───────────────────────────────────────────────────
// Re-read from the original env since we cleared it above
const tursoUrl   = "libsql://sentinel-iabdulwasey.aws-ap-south-1.turso.io";
const tursoToken = process.env.TURSO_AUTH_TOKEN;
const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: tursoToken });
const turso = new PrismaClient({ adapter });

async function migrate() {
  console.log("Migrating local SQLite → Turso…\n");

  // ── Core reference data ───────────────────────────────────────────────
  const markets = await local.market.findMany();
  console.log(`Markets: ${markets.length}`);
  for (const r of markets) await turso.market.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const users = await local.user.findMany();
  console.log(`Users: ${users.length}`);
  for (const r of users) await turso.user.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const rulesets = await local.regulatoryRuleset.findMany();
  console.log(`Rulesets: ${rulesets.length}`);
  for (const r of rulesets) await turso.regulatoryRuleset.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const appMeta = await local.appMeta.findMany();
  console.log(`AppMeta: ${appMeta.length}`);
  for (const r of appMeta) await turso.appMeta.upsert({ where: { key: r.key }, create: r as never, update: r as never });

  // ── Authority Requests ────────────────────────────────────────────────
  const arrReqs = await local.authorityRequest.findMany();
  console.log(`AuthorityRequests: ${arrReqs.length}`);
  for (const r of arrReqs) await turso.authorityRequest.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  // ── Fleet Partners + related ─────────────────────────────────────────
  const partners = await local.fleetPartner.findMany();
  console.log(`FleetPartners: ${partners.length}`);
  for (const r of partners) await turso.fleetPartner.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const drivers = await local.driver.findMany();
  console.log(`Drivers: ${drivers.length}`);
  for (const r of drivers) await turso.driver.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const vehicles = await local.vehicle.findMany();
  console.log(`Vehicles: ${vehicles.length}`);
  for (const r of vehicles) await turso.vehicle.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const trips = await local.trip.findMany();
  console.log(`Trips: ${trips.length}`);
  // batch trips in chunks of 200
  for (let i = 0; i < trips.length; i += 200) {
    const chunk = trips.slice(i, i + 200);
    for (const r of chunk) await turso.trip.upsert({ where: { id: r.id }, create: r as never, update: r as never });
    process.stdout.write(`\r  trips: ${Math.min(i + 200, trips.length)}/${trips.length}`);
  }
  console.log();

  // ── Documents + ground truth ─────────────────────────────────────────
  const docs = await local.document.findMany();
  console.log(`Documents: ${docs.length}`);
  for (const r of docs) await turso.document.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const gts = await local.documentGroundTruth.findMany();
  console.log(`DocumentGroundTruths: ${gts.length}`);
  for (const r of gts) await turso.documentGroundTruth.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  // ── Pipeline data ─────────────────────────────────────────────────────
  const runs = await local.pipelineRun.findMany();
  console.log(`PipelineRuns: ${runs.length}`);
  for (const r of runs) await turso.pipelineRun.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const stages = await local.pipelineStage.findMany();
  console.log(`PipelineStages: ${stages.length}`);
  for (const r of stages) await turso.pipelineStage.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  // ── Compliance outputs ────────────────────────────────────────────────
  const validations = await local.validation.findMany();
  console.log(`Validations: ${validations.length}`);
  for (const r of validations) await turso.validation.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const crossChecks = await local.crossCheck.findMany();
  console.log(`CrossChecks: ${crossChecks.length}`);
  for (const r of crossChecks) await turso.crossCheck.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const risks = await local.riskAssessment.findMany();
  console.log(`RiskAssessments: ${risks.length}`);
  for (const r of risks) await turso.riskAssessment.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const reportFields = await local.reportField.findMany();
  console.log(`ReportFields: ${reportFields.length}`);
  for (const r of reportFields) await turso.reportField.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const events = await local.complianceEvent.findMany();
  console.log(`ComplianceEvents: ${events.length}`);
  for (const r of events) await turso.complianceEvent.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const history = await local.partnerHistory.findMany();
  console.log(`PartnerHistory: ${history.length}`);
  for (const r of history) await turso.partnerHistory.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const rulesetImports = await local.rulesetImport.findMany();
  console.log(`RulesetImports: ${rulesetImports.length}`);
  for (const r of rulesetImports) await turso.rulesetImport.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  // ── Governance / audit ────────────────────────────────────────────────
  const aiLogs = await local.aiCallLog.findMany();
  console.log(`AiCallLogs: ${aiLogs.length}`);
  for (const r of aiLogs) await turso.aiCallLog.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  const auditLogs = await local.auditLog.findMany();
  console.log(`AuditLogs: ${auditLogs.length}`);
  for (const r of auditLogs) await turso.auditLog.upsert({ where: { id: r.id }, create: r as never, update: r as never });

  console.log("\n✓ Migration complete.");

  // ── Final verification ────────────────────────────────────────────────
  const counts = await Promise.all([
    turso.fleetPartner.count(),
    turso.pipelineRun.count(),
    turso.validation.count(),
    turso.riskAssessment.count(),
    turso.complianceEvent.count(),
    turso.auditLog.count(),
    turso.document.count(),
  ]);
  console.log(`\nTurso now has:`);
  console.log(`  partners:${counts[0]} pipeline_runs:${counts[1]} validations:${counts[2]} risk:${counts[3]} events:${counts[4]} audit:${counts[5]} docs:${counts[6]}`);

  await local.$disconnect();
  await turso.$disconnect();
  process.exit(0);
}

migrate().catch((e) => { console.error(e); process.exit(1); });
