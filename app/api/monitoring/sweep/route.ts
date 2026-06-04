export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { guard, ok } from "@/lib/api";
import { resolveMarketId } from "@/lib/anchor";
import { runSweep } from "@/surfaces/fleet-monitoring/monitor";

export async function POST(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const body = (await req.json().catch(() => ({}))) as { market?: string };
  const marketId = await resolveMarketId(body.market);
  const results = await runSweep(marketId);
  const summary = {
    swept: results.length,
    expiring: results.filter((r) => r.monitoringStatus === "EXPIRING_SOON").length,
    drift: results.filter((r) => r.driftDetected).length,
    reflag: results.filter((r) => r.rulesetReflag).length,
  };
  return ok(summary);
}
