import { db } from "../../lib/db";
import { writeAudit } from "./audit";
import type { ArrStatus, PartnerStatus, MonitoringStatus, RegulationImportStatus } from "../types/enums";

/**
 * Governance state machines. Nothing binds without a human action: the system never reaches
 * APPROVED/REJECTED (ARR/B1) or SUSPENDED_RECOMMENDED/CONDITIONS_APPLIED (B2) on its own — those
 * transitions only occur via a human decision recorded in the audit log.
 */

const ARR_TRANSITIONS: Record<ArrStatus, ArrStatus[]> = {
  RECEIVED: ["PROCESSING", "NEEDS_CLARIFICATION"],
  PROCESSING: ["PENDING_REVIEW", "NEEDS_CLARIFICATION"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "NEEDS_CLARIFICATION", "PROCESSING"],
  NEEDS_CLARIFICATION: ["PROCESSING", "RECEIVED", "APPROVED", "REJECTED"],
  APPROVED: ["DONE"],
  REJECTED: ["DONE"],
  DONE: [],
};

const PARTNER_TRANSITIONS: Record<PartnerStatus, PartnerStatus[]> = {
  RECEIVED: ["PROCESSING", "NEEDS_CLARIFICATION"],
  PROCESSING: ["PENDING_REVIEW", "NEEDS_CLARIFICATION"],
  PENDING_REVIEW: ["APPROVED", "CONDITIONS_APPLIED", "REJECTED", "NEEDS_CLARIFICATION", "PROCESSING"],
  NEEDS_CLARIFICATION: ["PROCESSING", "RECEIVED"],
  APPROVED: [],
  CONDITIONS_APPLIED: [],
  REJECTED: [],
};

const MONITORING_TRANSITIONS: Record<MonitoringStatus, MonitoringStatus[]> = {
  COMPLIANT: ["EXPIRING_SOON", "DRIFT_DETECTED", "PENDING_REVIEW"],
  EXPIRING_SOON: ["PENDING_REVIEW", "COMPLIANT", "DRIFT_DETECTED"],
  DRIFT_DETECTED: ["PENDING_REVIEW", "COMPLIANT"],
  PENDING_REVIEW: ["REMEDIATED", "CONDITIONS_APPLIED", "SUSPENDED_RECOMMENDED", "COMPLIANT"],
  REMEDIATED: ["COMPLIANT", "PENDING_REVIEW"],
  CONDITIONS_APPLIED: ["COMPLIANT", "PENDING_REVIEW"],
  SUSPENDED_RECOMMENDED: ["COMPLIANT", "PENDING_REVIEW"],
};

const REGIMPORT_TRANSITIONS: Record<RegulationImportStatus, RegulationImportStatus[]> = {
  RECEIVED: ["PROCESSING"],
  PROCESSING: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["ACTIVATED", "REJECTED", "NEEDS_EDIT"],
  NEEDS_EDIT: ["PENDING_REVIEW", "PROCESSING"],
  ACTIVATED: ["DONE"],
  REJECTED: ["DONE"],
  DONE: [],
};

function assertTransition<T extends string>(map: Record<T, T[]>, from: T, to: T) {
  if (from === to) return;
  if (!map[from]?.includes(to)) {
    throw new Error(`Illegal state transition ${from} → ${to}`);
  }
}

export async function setArrStatus(
  id: string,
  to: ArrStatus,
  opts: { actorType?: "HUMAN" | "AI" | "SYSTEM"; actorUserId?: string; reason?: string } = {},
) {
  const req = await db.authorityRequest.findUniqueOrThrow({ where: { id }, select: { status: true } });
  assertTransition(ARR_TRANSITIONS, req.status as ArrStatus, to);
  const updated = await db.authorityRequest.update({ where: { id }, data: { status: to, statusReason: opts.reason } });
  await writeAudit({
    actorType: opts.actorType ?? "SYSTEM",
    actorUserId: opts.actorUserId,
    action: "ARR_STATUS_CHANGE",
    entity: "AuthorityRequest",
    entityId: id,
    before: { status: req.status },
    after: { status: to, reason: opts.reason },
  });
  return updated;
}

export async function setPartnerStatus(
  id: string,
  to: PartnerStatus,
  opts: { actorType?: "HUMAN" | "AI" | "SYSTEM"; actorUserId?: string; reason?: string } = {},
) {
  const p = await db.fleetPartner.findUniqueOrThrow({ where: { id }, select: { status: true } });
  assertTransition(PARTNER_TRANSITIONS, p.status as PartnerStatus, to);
  const updated = await db.fleetPartner.update({ where: { id }, data: { status: to } });
  await writeAudit({
    actorType: opts.actorType ?? "SYSTEM",
    actorUserId: opts.actorUserId,
    action: "PARTNER_STATUS_CHANGE",
    entity: "FleetPartner",
    entityId: id,
    before: { status: p.status },
    after: { status: to, reason: opts.reason },
  });
  return updated;
}

export async function setRegImportStatus(
  id: string,
  to: RegulationImportStatus,
  opts: { actorType?: "HUMAN" | "AI" | "SYSTEM"; actorUserId?: string; reason?: string } = {},
) {
  const imp = await db.rulesetImport.findUniqueOrThrow({ where: { id }, select: { status: true } });
  assertTransition(REGIMPORT_TRANSITIONS, imp.status as RegulationImportStatus, to);
  const updated = await db.rulesetImport.update({ where: { id }, data: { status: to, statusReason: opts.reason } });
  await writeAudit({
    actorType: opts.actorType ?? "SYSTEM",
    actorUserId: opts.actorUserId,
    action: "REGIMPORT_STATUS_CHANGE",
    entity: "RulesetImport",
    entityId: id,
    before: { status: imp.status },
    after: { status: to, reason: opts.reason },
  });
  return updated;
}

export async function setMonitoringStatus(
  id: string,
  to: MonitoringStatus,
  opts: { actorType?: "HUMAN" | "AI" | "SYSTEM"; actorUserId?: string; reason?: string } = {},
) {
  const p = await db.fleetPartner.findUniqueOrThrow({ where: { id }, select: { monitoringStatus: true } });
  assertTransition(MONITORING_TRANSITIONS, p.monitoringStatus as MonitoringStatus, to);
  const updated = await db.fleetPartner.update({ where: { id }, data: { monitoringStatus: to, monitoringReason: opts.reason } });
  await writeAudit({
    actorType: opts.actorType ?? "SYSTEM",
    actorUserId: opts.actorUserId,
    action: "MONITORING_STATUS_CHANGE",
    entity: "FleetPartner",
    entityId: id,
    before: { monitoringStatus: p.monitoringStatus },
    after: { monitoringStatus: to, reason: opts.reason },
  });
  return updated;
}
