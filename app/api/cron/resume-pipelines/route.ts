export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import "@/surfaces/all";
import { db } from "@/lib/db";
import { advanceOneStage } from "@/engine/pipeline/runner";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  const token = new URL(req.url).searchParams.get("token");
  return auth === `Bearer ${secret}` || token === secret;
}

/** Recovers pipeline runs left QUEUED/RUNNING (e.g. a function timed out mid-stage). */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const cutoff = new Date(Date.now() - 2 * 60_000);
  const stuck = await db.pipelineRun.findMany({ where: { status: { in: ["QUEUED", "RUNNING"] }, updatedAt: { lt: cutoff } }, take: 20 });
  let resumed = 0;
  for (const run of stuck) {
    // reset a stage left RUNNING past the cutoff so it can be re-claimed
    await db.pipelineStage.updateMany({ where: { runId: run.id, status: "RUNNING", startedAt: { lt: cutoff } }, data: { status: "PENDING" } });
    try {
      await advanceOneStage(run.id);
      resumed++;
    } catch {
      /* leave for next sweep */
    }
  }
  return NextResponse.json({ ok: true, data: { stuck: stuck.length, resumed } });
}
