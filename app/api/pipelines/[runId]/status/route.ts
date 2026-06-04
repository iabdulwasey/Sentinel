export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import "@/surfaces/all";
import { getPipeline } from "@/engine/pipeline/registry";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import type { Surface } from "@/engine/types/enums";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { runId } = await ctx.params;
  const run = await db.pipelineRun.findUnique({ where: { id: runId }, include: { stages: { orderBy: { ordering: "asc" } } } });
  if (!run) return fail("Run not found", 404);

  let labels: Record<string, string> = {};
  try {
    labels = Object.fromEntries(getPipeline(run.surface as Surface).stages.map((s) => [s.name, s.label]));
  } catch {
    labels = {};
  }

  return ok({
    id: run.id,
    surface: run.surface,
    status: run.status,
    statusReason: run.statusReason,
    currentStage: run.currentStage,
    elapsedMs: run.elapsedMs,
    stages: run.stages.map((s) => ({
      name: s.name,
      label: labels[s.name] ?? s.name,
      status: s.status,
      progressPct: s.progressPct,
      note: s.note,
      durationMs: s.durationMs,
      startedAt: s.startedAt,
      confidence: s.confidence,
      blockReason: s.blockReason,
      output: s.output,
    })),
  });
}
