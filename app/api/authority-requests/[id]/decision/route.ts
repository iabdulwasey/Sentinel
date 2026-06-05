export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import "@/surfaces/all";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { setArrStatus } from "@/engine/governance/state";
import { writeAudit } from "@/engine/governance/audit";
import { startPipeline } from "@/engine/pipeline/runner";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const { action, note } = (await req.json().catch(() => ({}))) as { action?: string; note?: string };

  try {
    if (action === "regenerate") {
      const runId = await startPipeline("ARR", id);
      return ok({ status: "PROCESSING", runId });
    }

    // Reviewer answers an outstanding clarification: append it to the request
    // context, record it, and re-run the ARR pipeline so the AI can resolve it.
    if (action === "clarify") {
      if (!note?.trim()) return fail("Provide the clarification before re-running.");
      const reqRow = await db.authorityRequest.findUniqueOrThrow({ where: { id }, select: { rawText: true } });
      const appended = `${reqRow.rawText ?? ""}\n\n--- Reviewer clarification (${new Date().toISOString().slice(0, 10)}) ---\n${note.trim()}`;
      await db.authorityRequest.update({ where: { id }, data: { rawText: appended, reviewNote: note.trim() } });
      await writeAudit({
        actorType: "HUMAN",
        actorUserId: user.id,
        action: "ARR_CLARIFICATION",
        entity: "AuthorityRequest",
        entityId: id,
        after: { note: note.trim() },
      });
      const runId = await startPipeline("ARR", id);
      return ok({ status: "PROCESSING", runId });
    }

    const map: Record<string, "APPROVED" | "REJECTED" | "NEEDS_CLARIFICATION"> = {
      approve: "APPROVED",
      reject: "REJECTED",
      request_changes: "NEEDS_CLARIFICATION",
    };
    const target = action ? map[action] : undefined;
    if (!target) return fail("Unknown action");

    await setArrStatus(id, target, { actorType: "HUMAN", actorUserId: user.id, reason: note });
    await db.authorityRequest.update({ where: { id }, data: { reviewedByUserId: user.id, reviewNote: note, decidedAt: new Date() } });
    return ok({ status: target });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not record the decision.", 409);
  }
}
