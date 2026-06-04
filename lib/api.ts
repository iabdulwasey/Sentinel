import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "./auth";

/** Structured JSON envelopes for route handlers. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}
export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Guard a route handler. Returns the user or a 401 NextResponse. */
export async function guard(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return fail("Unauthenticated", 401);
  return user;
}
