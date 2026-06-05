export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { getSettings, saveSettings } from "@/lib/settings";
import { writeAudit } from "@/engine/governance/audit";

const SECRET_KEY = "secret.apiTokens"; // { [id]: sha256(token) } — for authenticating inbound ingest

/** Generate an ingest API token (ADMIN). The full token is returned ONCE; only a preview is stored. */
export async function POST(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  if (user.role !== "ADMIN") return fail("Admin only.", 403);
  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const label = body.label?.trim() || "Ingest token";

  const id = crypto.randomBytes(5).toString("hex");
  const secret = crypto.randomBytes(24).toString("hex");
  const token = `sk_sentinel_${secret}`;
  const preview = `sk_sentinel_…${secret.slice(-4)}`;
  const hash = crypto.createHash("sha256").update(token).digest("hex");

  const row = await db.appMeta.findUnique({ where: { key: SECRET_KEY } });
  const map = ((row?.value as Record<string, string> | null) ?? {});
  map[id] = hash;
  await db.appMeta.upsert({ where: { key: SECRET_KEY }, create: { key: SECRET_KEY, value: map }, update: { value: map } });

  const settings = await getSettings();
  const apiTokens = [...settings.connectors.apiTokens, { id, label, preview, createdAt: new Date().toISOString() }];
  await saveSettings({ ...settings, connectors: { ...settings.connectors, apiTokens } });
  await writeAudit({ actorType: "HUMAN", actorUserId: user.id, action: "API_TOKEN_CREATED", entity: "Settings", entityId: id, after: { label } });

  return ok({ id, label, preview, token }); // token shown once
}

/** Revoke an ingest token (ADMIN). Query: ?id= */
export async function DELETE(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  if (user.role !== "ADMIN") return fail("Admin only.", 403);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing token id.", 400);

  const row = await db.appMeta.findUnique({ where: { key: SECRET_KEY } });
  const map = ((row?.value as Record<string, string> | null) ?? {});
  delete map[id];
  await db.appMeta.upsert({ where: { key: SECRET_KEY }, create: { key: SECRET_KEY, value: map }, update: { value: map } });

  const settings = await getSettings();
  await saveSettings({ ...settings, connectors: { ...settings.connectors, apiTokens: settings.connectors.apiTokens.filter((t) => t.id !== id) } });
  await writeAudit({ actorType: "HUMAN", actorUserId: user.id, action: "API_TOKEN_REVOKED", entity: "Settings", entityId: id });
  return ok({ revoked: id });
}
