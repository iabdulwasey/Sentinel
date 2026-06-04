export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import "@/surfaces/all";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { setPartnerStatus } from "@/engine/governance/state";
import { startPipeline } from "@/engine/pipeline/runner";
import { writeAudit } from "@/engine/governance/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const { action, note } = (await req.json().catch(() => ({}))) as { action?: string; note?: string };

  if (action === "regenerate") {
    const runId = await startPipeline("B1", id);
    return ok({ status: "PROCESSING", runId });
  }

  const partner = await db.fleetPartner.findUniqueOrThrow({ where: { id }, include: { market: true } });
  const map: Record<string, "APPROVED" | "CONDITIONS_APPLIED" | "REJECTED"> = {
    approve: "APPROVED",
    approve_with_conditions: "CONDITIONS_APPLIED",
    reject: "REJECTED",
  };
  const target = action ? map[action] : undefined;
  if (!target) return fail("Unknown action");

  await setPartnerStatus(id, target, { actorType: "HUMAN", actorUserId: user.id, reason: note });

  const decision = (partner.decision as Record<string, unknown> | null) ?? {};
  const onboarded = target === "APPROVED" || target === "CONDITIONS_APPLIED";
  await db.fleetPartner.update({
    where: { id },
    data: {
      decision: { ...decision, draft: false, decidedBy: user.id, decidedAt: new Date().toISOString(), humanNote: note } as object,
      onboardedAt: onboarded ? new Date() : undefined,
      monitoringStatus: onboarded ? "COMPLIANT" : partner.monitoringStatus,
      lastAssessedAt: onboarded ? new Date() : undefined,
      lastAssessedRulesetVersion: onboarded ? partner.market.activeRulesetVersion : undefined,
    },
  });

  if (onboarded) {
    await db.partnerHistory.create({
      data: { partnerId: id, kind: "ONBOARDED", detail: { outcome: target, note }, occurredAt: new Date() },
    });
  }
  await writeAudit({ actorType: "HUMAN", actorUserId: user.id, action: "ONBOARDING_DECISION", entity: "FleetPartner", entityId: id, after: { outcome: target, note } });
  return ok({ status: target });
}
