export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { guard, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyAuditChain } from "@/engine/governance/audit";

/** Recompute the audit hash-chain and report whether it is intact. */
export async function POST() {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const result = await verifyAuditChain();
  const entries = await db.auditLog.count();
  return ok({ ...result, entries });
}
