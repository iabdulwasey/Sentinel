export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { login } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

/** GET — lightweight warm-up called by the login page on mount to pre-warm this function + DB. */
export async function GET() {
  const { db } = await import("@/lib/db");
  await db.appMeta.count();
  return ok({ ok: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };
  if (!email || !password) return fail("Email and password are required.");
  const user = await login(email, password);
  if (!user) return fail("Invalid email or password.", 401);
  return ok(user);
}
