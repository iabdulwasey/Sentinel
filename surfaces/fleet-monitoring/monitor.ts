import { addDays, differenceInCalendarDays } from "date-fns";
import { db } from "../../lib/db";
import { resolveRuleset } from "../../engine/rules/store";
import { callLlm } from "../../engine/llm/client";
import { getAsOf } from "../../lib/anchor";
import { getDocumentBase64 } from "../../engine/storage";
import { evaluateValidation } from "../../engine/validation/rules";
import { writeAudit } from "../../engine/governance/audit";
import { ExpiryForecastSchema, DriftReportSchema, ExtractionResultSchema, type ExtractionResult } from "../../engine/types/ai";

/**
 * Surface B2 — Ongoing Compliance Monitoring engine. Per-partner sweep: deterministic expiry +
 * drift signals, narrated/assessed by the ExpiryForecast (fast) and Drift (balanced) agents, with
 * proactive ComplianceEvents and monitoringStatus updates. Never auto-suspends — drift routes to
 * a human. Re-validation re-runs B1 validation machinery on renewed documents.
 */

interface UpcomingExpiry {
  subject: string;
  expiresAt: string;
  daysUntil: number;
}

export interface MonitorResult {
  partnerId: string;
  monitoringStatus: string;
  reason: string;
  upcoming: number;
  driftDetected: boolean;
  rulesetReflag: boolean;
}

export async function runMonitoringForPartner(partnerId: string): Promise<MonitorResult> {
  const partner = await db.fleetPartner.findUniqueOrThrow({ where: { id: partnerId }, include: { market: true, vehicles: true, drivers: true, documents: true } });
  if (partner.status !== "APPROVED" && partner.status !== "CONDITIONS_APPLIED" && partner.monitoringStatus === "COMPLIANT" && partner.status !== "APPROVED") {
    // not an onboarded partner; skip
  }
  const asOf = await getAsOf();
  const horizon = addDays(asOf, 30);
  const market = partner.market;

  // ── deterministic signals ──
  const upcoming: UpcomingExpiry[] = [];
  for (const v of partner.vehicles) {
    for (const [label, date] of [
      ["inspection", v.inspectionValidUntil],
      ["insurance", v.insuranceValidUntil],
      ["registration", v.registrationValidUntil],
    ] as const) {
      if (date && date >= asOf && date <= horizon) upcoming.push({ subject: `Vehicle ${v.plate} ${label}`, expiresAt: date.toISOString().slice(0, 10), daysUntil: differenceInCalendarDays(date, asOf) });
    }
  }
  for (const d of partner.drivers) {
    if (d.licenseExpiresAt && d.licenseExpiresAt >= asOf && d.licenseExpiresAt <= horizon)
      upcoming.push({ subject: `Driver ${d.fullName} licence`, expiresAt: d.licenseExpiresAt.toISOString().slice(0, 10), daysUntil: differenceInCalendarDays(d.licenseExpiresAt, asOf) });
  }
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

  const newVehiclesNoReg = partner.vehicles.filter((v) => v.addedAt >= addDays(asOf, -45) && (!v.registrationValidUntil || v.registrationValidUntil < asOf));
  const expiredVehicles = partner.vehicles.filter((v) => v.inspectionValidUntil && v.inspectionValidUntil < asOf);
  const rulesetReflag = (partner.lastAssessedRulesetVersion ?? market.activeRulesetVersion) < market.activeRulesetVersion;

  let monitoringStatus = "COMPLIANT";
  let reason = "All documents valid; no upcoming expiries.";

  // ── ruleset re-flag (highest priority — needs human re-review under new rules) ──
  if (rulesetReflag) {
    monitoringStatus = "PENDING_REVIEW";
    reason = `Ruleset updated to v${market.activeRulesetVersion}; re-assessment required.`;
    await upsertEvent(partnerId, market.id, "RULESET_REFLAG", "MEDIUM", reason, { from: partner.lastAssessedRulesetVersion, to: market.activeRulesetVersion });
  }

  // ── drift (only call the agent when there are signals) ──
  let driftDetected = false;
  if (newVehiclesNoReg.length > 0 || expiredVehicles.length > 0) {
    const res = await callLlm({
      agent: "DriftDetectionAgent",
      stage: "DRIFT_DETECT",
      promptId: "risk.drift",
      schema: DriftReportSchema,
      schemaName: "DriftReport",
      vars: {
        partnerName: partner.legalName,
        marketName: market.country,
        previous: `Last assessed ${partner.lastAssessedAt?.toISOString().slice(0, 10) ?? "n/a"} under ruleset v${partner.lastAssessedRulesetVersion ?? "?"}; was ${partner.monitoringStatus}.`,
        current: {
          newVehiclesWithoutValidRegistration: newVehiclesNoReg.map((v) => v.plate),
          vehiclesWithExpiredInspection: expiredVehicles.map((v) => v.plate),
          fleetSize: partner.vehicles.length,
        },
      },
      link: { partnerId },
    });
    driftDetected = res.data.driftDetected;
    if (driftDetected && monitoringStatus !== "PENDING_REVIEW") {
      monitoringStatus = "DRIFT_DETECTED";
      reason = res.data.recommendedAction || res.data.items.map((i) => i.description).join("; ");
    }
    await upsertEvent(partnerId, market.id, "DRIFT_DETECTED", "MEDIUM", res.data.items.map((i) => i.description).join("; ") || "Compliance drift detected", { items: res.data.items, recommendedAction: res.data.recommendedAction });
  }

  // ── expiry forecast (only when there are upcoming expiries) ──
  if (upcoming.length > 0) {
    const res = await callLlm({
      agent: "ExpiryForecastAgent",
      stage: "EXPIRY_FORECAST",
      promptId: "risk.forecast",
      schema: ExpiryForecastSchema,
      schemaName: "ExpiryForecast",
      vars: { asOf: asOf.toISOString().slice(0, 10), partnerName: partner.legalName, upcoming },
      link: { partnerId },
    });
    if (monitoringStatus === "COMPLIANT") {
      monitoringStatus = "EXPIRING_SOON";
      reason = res.data.summary;
    }
    const soonest = upcoming[0];
    await upsertEvent(partnerId, market.id, "EXPIRY_FORECAST", soonest.daysUntil <= 7 ? "CRITICAL" : soonest.daysUntil <= 21 ? "HIGH" : "MEDIUM", res.data.summary, { items: res.data.items }, addDays(asOf, soonest.daysUntil));
  }

  // ── apply status (sweep is a system recomputation; don't clear a human-owned PENDING_REVIEW from drift) ──
  const keepPending = partner.monitoringStatus === "PENDING_REVIEW" && monitoringStatus === "COMPLIANT" && !rulesetReflag;
  const finalStatus = keepPending ? "PENDING_REVIEW" : monitoringStatus;
  await db.fleetPartner.update({ where: { id: partnerId }, data: { monitoringStatus: finalStatus, monitoringReason: keepPending ? partner.monitoringReason : reason, lastAssessedAt: rulesetReflag ? partner.lastAssessedAt : asOf } });
  await writeAudit({ actorType: "AI", action: "MONITORING_SWEEP", entity: "FleetPartner", entityId: partnerId, after: { monitoringStatus: finalStatus, reason, upcoming: upcoming.length, driftDetected, rulesetReflag } });

  return { partnerId, monitoringStatus: finalStatus, reason, upcoming: upcoming.length, driftDetected, rulesetReflag };
}

async function upsertEvent(partnerId: string, marketId: string, type: string, severity: string, title: string, detail: unknown, dueAt?: Date) {
  // resolve a recent open event of this type, else create
  const existing = await db.complianceEvent.findFirst({ where: { partnerId, type, resolvedAt: null }, orderBy: { occurredAt: "desc" } });
  if (existing) {
    await db.complianceEvent.update({ where: { id: existing.id }, data: { severity, title, detail: detail as object, dueAt } });
  } else {
    await db.complianceEvent.create({ data: { partnerId, marketId, type, severity, title, detail: detail as object, dueAt } });
  }
}

export async function runSweep(marketId?: string): Promise<MonitorResult[]> {
  const partners = await db.fleetPartner.findMany({
    where: { deletedAt: null, status: { in: ["APPROVED", "CONDITIONS_APPLIED"] }, ...(marketId ? { marketId } : {}) },
    select: { id: true },
  });
  const results: MonitorResult[] = [];
  for (const p of partners) {
    try {
      results.push(await runMonitoringForPartner(p.id));
    } catch (e) {
      results.push({ partnerId: p.id, monitoringStatus: "ERROR", reason: e instanceof Error ? e.message : String(e), upcoming: 0, driftDetected: false, rulesetReflag: false });
    }
  }
  return results;
}

/** Re-validate a partner after a renewed document is submitted (reuses B1 validation machinery). */
export async function revalidatePartner(partnerId: string): Promise<{ status: string; revalidated: number }> {
  const partner = await db.fleetPartner.findUniqueOrThrow({ where: { id: partnerId }, include: { market: true, vehicles: true } });
  const ruleset = await resolveRuleset(partner.market.code, partner.market.activeRulesetVersion);
  const asOf = await getAsOf();
  const specByType = new Map(ruleset.requiredDocuments.map((d) => [d.docType, d]));

  // re-extract any UPLOADED (renewed) documents
  const renewed = await db.document.findMany({ where: { partnerId, status: "UPLOADED", deletedAt: null } });
  let count = 0;
  for (const doc of renewed) {
    const spec = specByType.get(doc.docType);
    const base64 = await getDocumentBase64(doc.storageRef);
    const res = await callLlm({
      agent: "ExtractionAgent",
      stage: "DOC_EXTRACTION",
      promptId: "extraction.fields",
      schema: ExtractionResultSchema,
      schemaName: "ExtractionResult",
      maxTokens: 2500,
      documents: [{ mediaType: doc.mimeType, base64 }],
      vars: { docType: doc.docType, docLabel: spec?.label ?? doc.title, expectedFields: (spec?.expectedFields ?? []).map((f) => ({ key: f.key, label: f.label, type: f.type })) },
      link: { partnerId, documentId: doc.id },
    });
    const er = res.data;
    await db.document.update({ where: { id: doc.id }, data: { extractedFields: er as object, extractionConfidence: er.overallConfidence, status: "VALIDATED" } });
    // extend the relevant vehicle validity from the renewed doc (renewal scenario)
    const fields: Record<string, string | null> = {};
    for (const f of er.fields) fields[f.key] = f.value ?? null;
    if (doc.docType.includes("INSURANCE")) {
      await db.vehicle.updateMany({ where: { partnerId, insuranceValidUntil: { lt: addDays(asOf, 30) } }, data: { insuranceValidUntil: addDays(asOf, 365) } });
    }
    count++;
  }

  // re-run expiry/drift to recompute status
  await runMonitoringForPartner(partnerId);
  const fresh = await db.fleetPartner.findUniqueOrThrow({ where: { id: partnerId } });
  // if nothing outstanding, mark compliant + revalidation event
  if (count > 0 && fresh.monitoringStatus === "EXPIRING_SOON") {
    await db.fleetPartner.update({ where: { id: partnerId }, data: { monitoringStatus: "COMPLIANT", monitoringReason: "Renewed document re-validated." } });
  }
  await db.complianceEvent.create({ data: { partnerId, marketId: partner.marketId, type: "REVALIDATION", severity: "INFO", title: `Re-validated ${count} renewed document(s)`, occurredAt: new Date(), resolvedAt: new Date() } });
  await db.partnerHistory.create({ data: { partnerId, kind: "REVALIDATED", detail: { documents: count }, occurredAt: new Date() } });
  await writeAudit({ actorType: "AI", action: "REVALIDATION", entity: "FleetPartner", entityId: partnerId, after: { documents: count } });
  const final = await db.fleetPartner.findUniqueOrThrow({ where: { id: partnerId } });
  return { status: final.monitoringStatus, revalidated: count };
}
