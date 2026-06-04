export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { setRegImportStatus } from "@/engine/governance/state";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { note?: string };

  const imp = await db.rulesetImport.findUnique({ where: { id }, select: { status: true } });
  if (!imp) return fail("Import not found.", 404);
  if (imp.status !== "PENDING_REVIEW" && imp.status !== "NEEDS_EDIT") return fail(`Cannot reject from status ${imp.status}.`, 409);

  await db.rulesetImport.update({ where: { id }, data: { reviewedByUserId: user.id, reviewNote: body.note, decidedAt: new Date() } });
  await setRegImportStatus(id, "REJECTED", { actorType: "HUMAN", actorUserId: user.id, reason: body.note ?? "Rejected by reviewer" });
  return ok({ status: "REJECTED" });
}
