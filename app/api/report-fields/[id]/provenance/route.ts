export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { formatCost } from "@/lib/format";
import type { ProvenanceRef } from "@/engine/types/ai";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const field = await db.reportField.findUnique({ where: { id } });
  if (!field) return fail("Report field not found", 404);

  const refs = (field.provenance ?? []) as unknown as ProvenanceRef[];
  const sources: Array<{ entity: string; aggregation?: string; filterDescription?: string; rows: Array<Record<string, unknown>> }> = [];
  for (const ref of refs) {
    const ids = (ref.ids ?? []).slice(0, 50);
    let rows: Array<Record<string, unknown>> = [];
    if (ref.entity === "Driver") {
      const r = await db.driver.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, licenseNo: true, licenseExpiresAt: true, status: true } });
      rows = r.map((x) => ({ id: x.id, name: x.fullName, licenseNo: x.licenseNo, licenseExpiresAt: x.licenseExpiresAt, status: x.status }));
    } else if (ref.entity === "Vehicle") {
      const r = await db.vehicle.findMany({ where: { id: { in: ids } }, select: { id: true, plate: true, make: true, model: true, inspectionValidUntil: true, status: true } });
      rows = r.map((x) => ({ id: x.id, plate: x.plate, vehicle: `${x.make ?? ""} ${x.model ?? ""}`.trim(), inspectionValidUntil: x.inspectionValidUntil, status: x.status }));
    } else if (ref.entity === "Trip") {
      const r = await db.trip.findMany({ where: { id: { in: ids } }, select: { id: true, zone: true, startedAt: true, distanceKm: true } });
      rows = r.map((x) => ({ id: x.id, zone: x.zone, startedAt: x.startedAt, distanceKm: x.distanceKm }));
    } else if (ref.entity === "FleetPartner") {
      const r = await db.fleetPartner.findMany({ where: { id: { in: ids } }, select: { id: true, legalName: true, reference: true, riskBand: true } });
      rows = r.map((x) => ({ id: x.id, name: x.legalName, reference: x.reference, riskBand: x.riskBand }));
    }
    sources.push({ entity: ref.entity, aggregation: ref.aggregation, filterDescription: ref.filterDescription, rows });
  }

  let aiCall: { model: string; promptVersion: string; cost: string; confidence: number | null } | null = null;
  if (field.aiCallId) {
    const c = await db.aiCallLog.findUnique({ where: { id: field.aiCallId } });
    if (c) aiCall = { model: c.model, promptVersion: c.promptVersion, cost: formatCost(c.costMicroUsd), confidence: c.confidence };
  }

  return ok({
    fieldKey: field.fieldKey,
    label: field.label,
    value: field.value,
    classification: field.classification,
    verified: field.verified,
    totalSourceRows: refs.reduce((a, r) => a + (r.ids?.length ?? 0), 0),
    sources,
    aiCall,
  });
}
