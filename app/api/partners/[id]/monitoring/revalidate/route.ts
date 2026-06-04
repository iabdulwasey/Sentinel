export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { guard, ok } from "@/lib/api";
import { revalidatePartner } from "@/surfaces/fleet-monitoring/monitor";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const result = await revalidatePartner(id);
  return ok(result);
}
