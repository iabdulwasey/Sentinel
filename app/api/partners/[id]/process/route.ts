export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import "@/surfaces/all";
import { startPipeline } from "@/engine/pipeline/runner";
import { guard, ok } from "@/lib/api";
import { db } from "@/lib/db";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;

  const existing = await db.pipelineRun.findFirst({
    where: { partnerId: id, status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return ok({ runId: existing.id, resumed: true });

  const runId = await startPipeline("B1", id);
  return ok({ runId }, { status: 202 });
}
