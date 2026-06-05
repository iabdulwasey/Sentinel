export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { setActiveRole } from "@/lib/auth";
import { writeAudit } from "@/engine/governance/audit";

/** Switch the active role for the current session. Body: { role } */
export async function POST(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const body = (await req.json().catch(() => ({}))) as { role?: string };
  if (!body.role) return fail("Missing role.", 400);

  const switched = await setActiveRole(body.role);
  if (!switched) return fail("That role is not assigned to you.", 403);
  await writeAudit({ actorType: "HUMAN", actorUserId: user.id, action: "ACTIVE_ROLE_SWITCHED", entity: "User", entityId: user.id, before: { activeRole: user.activeRole }, after: { activeRole: body.role } });
  return ok({ activeRole: body.role });
}
