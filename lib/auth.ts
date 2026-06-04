import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";

/** Session-based auth with opaque tokens (sha256-hashed at rest) + role-aware access. */
const COOKIE = "sentinel_session";
const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token + (process.env.SESSION_SECRET ?? "dev")).digest("hex");
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "REVIEWER";
}

export async function login(email: string, password: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.isActive || !user.passwordHash) return null;
  if (!bcrypt.compareSync(password, user.passwordHash)) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } });

  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
  return { id: user.id, email: user.email, name: user.name, role: user.role as SessionUser["role"] };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
    jar.delete(COOKIE);
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const u = session.user;
  return { id: u.id, email: u.email, name: u.name, role: u.role as SessionUser["role"] };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}
