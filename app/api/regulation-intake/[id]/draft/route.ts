export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { MarketRulesetSchema } from "@/engine/types/ruleset";
import type { RulesetSynthesisOutput } from "@/engine/types/ai";
import { writeAudit } from "@/engine/governance/audit";

/** Save reviewer edits to the proposed (quarantined) ruleset. Re-parsed against the contract on save. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { ruleset?: unknown };

  const imp = await db.rulesetImport.findUnique({ where: { id } });
  if (!imp) return fail("Import not found.", 404);
  if (imp.status !== "PENDING_REVIEW" && imp.status !== "NEEDS_EDIT") return fail(`Cannot edit from status ${imp.status}.`, 409);

  const parsed = MarketRulesetSchema.safeParse(body.ruleset);
  if (!parsed.success) {
    return fail("Edited ruleset is invalid: " + parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 422);
  }

  const wrapper = (imp.draftRuleset as unknown as RulesetSynthesisOutput) ?? ({} as RulesetSynthesisOutput);
  const updated = { ...wrapper, ruleset: parsed.data };
  await db.rulesetImport.update({ where: { id }, data: { draftRuleset: updated as object } });
  await writeAudit({
    actorType: "HUMAN",
    actorUserId: user.id,
    action: "RULESET_DRAFT_EDITED",
    entity: "RulesetImport",
    entityId: id,
    after: { marketCode: parsed.data.marketCode, version: parsed.data.version },
  });
  return ok({ saved: true });
}
