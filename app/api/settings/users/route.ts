export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { writeAudit } from "@/engine/governance/audit";
import { ROLE_KEYS, deriveLegacyFromRoles } from "@/lib/rbac";

function cleanRoles(input: unknown): string[] {
  const arr = Array.isArray(input) ? (input as unknown[]).filter((r): r is string => typeof r === "string" && ROLE_KEYS.includes(r)) : [];
  return arr.length ? [...new Set(arr)] : ["compliance_reviewer"];
}

/** Create a teammate (ADMIN). Body: { email, name, password, roles[] } */
export async function POST(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes("users.manage")) return fail("Admin only.", 403);
  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string; password?: string; roles?: string[] };

  const email = body.email?.toLowerCase().trim();
  const name = body.name?.trim();
  const roles = cleanRoles(body.roles);
  const password = body.password?.trim();
  if (!email || !email.includes("@") || !name) return fail("Name and a valid email are required.", 422);
  if (!password || password.length < 6) return fail("Set a password of at least 6 characters.", 422);
  if (await db.user.findUnique({ where: { email } })) return fail("A user with that email already exists.", 409);

  const created = await db.user.create({
    data: { email, name, role: deriveLegacyFromRoles(roles), roles: roles as object, passwordHash: bcrypt.hashSync(password, 10), isActive: true },
  });
  await writeAudit({ actorType: "HUMAN", actorUserId: user.id, action: "USER_CREATED", entity: "User", entityId: created.id, after: { email, roles } });
  return ok({ id: created.id, email, name, role: created.role, roles, isActive: true });
}

/** Update a teammate's roles / active status / password (ADMIN). Body: { id, roles?, isActive?, password? } */
export async function PATCH(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  if (!user.permissions.includes("users.manage")) return fail("Admin only.", 403);
  const body = (await req.json().catch(() => ({}))) as { id?: string; roles?: string[]; isActive?: boolean; password?: string };
  if (!body.id) return fail("Missing user id.", 400);
  if (body.id === user.id && body.isActive === false) return fail("You can't deactivate your own account.", 400);

  const target = await db.user.findUnique({ where: { id: body.id }, select: { id: true, role: true, roles: true, isActive: true } });
  if (!target) return fail("User not found.", 404);

  const data: { role?: string; roles?: object; isActive?: boolean; passwordHash?: string } = {};
  if (Array.isArray(body.roles)) {
    const roles = cleanRoles(body.roles);
    data.roles = roles as object;
    data.role = deriveLegacyFromRoles(roles);
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.password && body.password.trim().length >= 6) data.passwordHash = bcrypt.hashSync(body.password.trim(), 10);

  const updated = await db.user.update({ where: { id: body.id }, data });
  await writeAudit({ actorType: "HUMAN", actorUserId: user.id, action: "USER_UPDATED", entity: "User", entityId: body.id, before: { roles: target.roles, isActive: target.isActive }, after: { roles: data.roles, isActive: data.isActive, passwordReset: !!data.passwordHash } });
  return ok({ id: updated.id, role: updated.role, roles: updated.roles, isActive: updated.isActive });
}
