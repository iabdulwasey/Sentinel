export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import "@/surfaces/all";
import { advanceOneStage } from "@/engine/pipeline/runner";
import { guard, ok } from "@/lib/api";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { runId } = await ctx.params;
  const result = await advanceOneStage(runId);
  return ok(result);
}
