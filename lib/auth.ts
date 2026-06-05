import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { normalizeRoles, defaultActiveRole, legacyRole, permissionsForRoles } from "./rbac";

/** Session-based auth with opaque tokens (sha256-hashed at rest) + multi-role RBAC. */
const COOKIE = "sentinel_session";
const ROLE_COOKIE = "sentinel_role"; // the active role for this session
const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token + (process.env.SESSION_SECRET ?? "dev")).digest("hex");
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "sentinel-salt").digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  const a = Buffer.from(hashPassword(password));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "REVIEWER"; // legacy tier, DERIVED from the active role (back-compat)
  roles: string[]; // all assigned RBAC role keys
  activeRole: string; // the role this session is acting through
  permissions: string[]; // permissions of the active role
}

function buildSessionUser(u: { id: string; email: string; name: string; role: string; roles: unknown }, activeRoleCookie?: string | null): SessionUser {
  const roles = normalizeRoles(u.roles, u.role);
  const activeRole = activeRoleCookie && roles.includes(activeRoleCookie) ? activeRoleCookie : defaultActiveRole(roles);
  return { id: u.id, email: u.email, name: u.name, roles, activeRole, permissions: permissionsForRoles([activeRole]), role: legacyRole(activeRole) };
}

export async function login(email: string, password: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.isActive || !user.passwordHash) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } });

  const su = buildSessionUser(user);
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", expires: expiresAt });
  jar.set(ROLE_COOKIE, su.activeRole, { httpOnly: true, sameSite: "lax", secure, path: "/", expires: expiresAt });
  return su;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
    jar.delete(COOKIE);
    jar.delete(ROLE_COOKIE);
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  return buildSessionUser(session.user, jar.get(ROLE_COOKIE)?.value ?? null);
}

/** Switch the active role for this session (must be one of the user's assigned roles). */
export async function setActiveRole(role: string): Promise<boolean> {
  const u = await getSessionUser();
  if (!u || !u.roles.includes(role)) return false;
  const jar = await cookies();
  jar.set(ROLE_COOKIE, role, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86400 });
  return true;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}
