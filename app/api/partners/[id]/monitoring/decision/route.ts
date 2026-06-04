export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { setMonitoringStatus } from "@/engine/governance/state";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const { action, note } = (await req.json().catch(() => ({}))) as { action?: string; note?: string };

  const map: Record<string, "REMEDIATED" | "CONDITIONS_APPLIED" | "SUSPENDED_RECOMMENDED" | "COMPLIANT"> = {
    remediate: "REMEDIATED",
    apply_conditions: "CONDITIONS_APPLIED",
    recommend_suspend: "SUSPENDED_RECOMMENDED",
    clear: "COMPLIANT",
  };
  const target = action ? map[action] : undefined;
  if (!target) return fail("Unknown action");

  await setMonitoringStatus(id, target, { actorType: "HUMAN", actorUserId: user.id, reason: note });
  await db.partnerHistory.create({ data: { partnerId: id, kind: target === "SUSPENDED_RECOMMENDED" ? "SUSPENSION" : target === "CONDITIONS_APPLIED" ? "CONDITION" : "REMEDIATION", detail: { action, note }, occurredAt: new Date() } });
  await db.complianceEvent.create({ data: { partnerId: id, type: "HUMAN_ACTION", severity: "INFO", title: `Human decision: ${(action ?? "").replace(/_/g, " ")}`, detail: { note }, occurredAt: new Date(), resolvedAt: new Date() } });
  return ok({ monitoringStatus: target });
}
