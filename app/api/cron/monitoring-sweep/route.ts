export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { runSweep } from "@/surfaces/fleet-monitoring/monitor";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev
  const auth = req.headers.get("authorization");
  const token = new URL(req.url).searchParams.get("token");
  return auth === `Bearer ${secret}` || token === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const results = await runSweep();
  return NextResponse.json({ ok: true, data: { swept: results.length, drift: results.filter((r) => r.driftDetected).length } });
}
