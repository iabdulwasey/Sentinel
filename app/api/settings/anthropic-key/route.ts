export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { getAnthropicKey, setAnthropicKey } from "@/lib/settings";
import { writeAudit } from "@/engine/governance/audit";

/** Set or clear the Anthropic API key override (stored separately from settings, never echoed). */
export async function POST(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  if (user.role !== "ADMIN") return fail("Admin only.", 403);
  const body = (await req.json().catch(() => ({}))) as { key?: string | null };

  const key = typeof body.key === "string" ? body.key.trim() : null;
  if (key && !key.startsWith("sk-ant-")) return fail("That doesn't look like an Anthropic API key (expected sk-ant-…).", 422);
  await setAnthropicKey(key || null);
  await writeAudit({ actorType: "HUMAN", actorUserId: user.id, action: key ? "ANTHROPIC_KEY_SET" : "ANTHROPIC_KEY_CLEARED", entity: "Settings", entityId: "anthropic-key" });

  const status = await getAnthropicKey();
  return ok({ source: status.source, last4: status.last4 });
}
