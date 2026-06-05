export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Lightweight warm-up endpoint — called on login page load to wake the function + DB connection. */
export async function GET() {
  await db.appMeta.count();
  return NextResponse.json({ ok: true });
}
