process.env.TURSO_DATABASE_URL = "";
import { db } from "../lib/db";

async function main() {
  const [runs, vals, risks, events, audits, nonReceived, withDecision] = await Promise.all([
    db.pipelineRun.count(),
    db.validation.count(),
    db.riskAssessment.count(),
    db.complianceEvent.count(),
    db.auditLog.count(),
    db.fleetPartner.count({ where: { status: { in: ["APPROVED","CONDITIONS_APPLIED","PENDING_REVIEW","PROCESSING"] } } }),
    db.fleetPartner.count({ where: { decision: { not: null } } }),
  ]);
  console.log(JSON.stringify({ pipelineRuns: runs, validations: vals, riskAssessments: risks, complianceEvents: events, auditLogs: audits, nonReceivedPartners: nonReceived, partnersWithDecision: withDecision }, null, 2));
  process.exit(0);
}
main();
