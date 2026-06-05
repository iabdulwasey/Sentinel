export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { getSettings, saveSettings, SettingsSchema, type Settings } from "@/lib/settings";
import { writeAudit } from "@/engine/governance/audit";

/** Save one settings section. Body: { section: keyof Settings, data: <section object> }. */
export async function PATCH(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const body = (await req.json().catch(() => ({}))) as { section?: string; data?: unknown };
  const section = body.section as keyof Settings | undefined;
  if (!section || !(section in SettingsSchema.shape)) return fail("Unknown settings section.", 400);

  const current = await getSettings();
  const next = { ...current, [section]: body.data } as Settings;
  const parsed = SettingsSchema.safeParse(next);
  if (!parsed.success) return fail("Invalid settings: " + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 422);

  await saveSettings(parsed.data);
  await writeAudit({ actorType: "HUMAN", actorUserId: user.id, action: "SETTINGS_UPDATED", entity: "Settings", entityId: section, after: { section } });
  return ok({ saved: true, settings: parsed.data });
}
