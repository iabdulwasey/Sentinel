export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { MarketRulesetSchema } from "@/engine/types/ruleset";
import type { RulesetSynthesisOutput, RegulationClassification } from "@/engine/types/ai";
import { hashRuleset, invalidateRulesetCache } from "@/engine/rules/store";
import { setRegImportStatus } from "@/engine/governance/state";
import { writeAudit } from "@/engine/governance/audit";

/**
 * The human-in-the-loop activation gate. AI proposed a draft ruleset; a reviewer activates it here.
 * This is the ONLY path by which an imported ruleset enters the rules table. It re-parses the draft
 * against MarketRulesetSchema (hard gate), creates the market (new) or a new version (update), bumps
 * the active version, re-flags affected partners (the B2 mechanic), and records a human audit event.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;

  const imp = await db.rulesetImport.findUnique({ where: { id } });
  if (!imp) return fail("Import not found.", 404);
  if (imp.status !== "PENDING_REVIEW" && imp.status !== "NEEDS_EDIT") {
    return fail(`Cannot activate from status ${imp.status}.`, 409);
  }
  const wrapper = imp.draftRuleset as unknown as RulesetSynthesisOutput | null;
  if (!wrapper?.ruleset) return fail("No draft ruleset to activate.", 400);

  // Hard gate: the draft (possibly human-edited) must parse against the contract.
  const parsed = MarketRulesetSchema.safeParse(wrapper.ruleset);
  if (!parsed.success) {
    return fail("Draft ruleset is invalid: " + parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 422);
  }
  const ruleset = parsed.data;
  const hash = hashRuleset(ruleset);
  const cls = imp.classification as unknown as RegulationClassification | null;

  let marketId = imp.targetMarketId;
  let reflagged = 0;

  if (imp.isNewMarket || !marketId) {
    // Guard against code collision (e.g. two imports proposing the same code).
    const clash = await db.market.findUnique({ where: { code: ruleset.marketCode } });
    if (clash) return fail(`A market with code ${ruleset.marketCode} already exists — re-classify this as an update.`, 409);
    const market = await db.market.create({
      data: {
        code: ruleset.marketCode,
        country: ruleset.country,
        countryIso2: cls?.countryIso2 ?? ruleset.marketCode.slice(0, 2),
        cities: cls?.cities ?? [],
        regulatorName: ruleset.regulator.name,
        regulatorCode: ruleset.regulator.code,
        privacyRegime: ruleset.compliancePolicy.privacyRegime,
        region: ruleset.region,
        timezone: ruleset.timezone,
        currency: ruleset.currency,
        locale: ruleset.locale,
        activeRulesetVersion: ruleset.version,
      },
    });
    marketId = market.id;
    await db.regulatoryRuleset.create({
      data: {
        marketId,
        version: ruleset.version,
        filePath: `db://import/${imp.reference}`,
        contentHash: hash,
        content: ruleset as object,
        source: "IMPORT",
        status: "ACTIVE",
        summary: `${ruleset.country} ruleset v${ruleset.version} — imported (${imp.reference})`,
        isActive: true,
      },
    });
  } else {
    const market = await db.market.findUniqueOrThrow({ where: { id: marketId } });
    // supersede the prior active version(s)
    await db.regulatoryRuleset.updateMany({ where: { marketId, isActive: true }, data: { isActive: false, status: "SUPERSEDED" } });
    await db.regulatoryRuleset.create({
      data: {
        marketId,
        version: ruleset.version,
        filePath: `db://import/${imp.reference}`,
        contentHash: hash,
        content: ruleset as object,
        source: "IMPORT",
        status: "ACTIVE",
        summary: `${ruleset.country} ruleset v${ruleset.version} — imported (${imp.reference})`,
        isActive: true,
        changelog: wrapper.changeNotes?.length ? { added: wrapper.changeNotes } : undefined,
      },
    });
    await db.market.update({ where: { id: marketId }, data: { activeRulesetVersion: ruleset.version } });

    // Re-flag partners whose last assessment predates the new version (proactive re-validation).
    const partners = await db.fleetPartner.findMany({
      where: { marketId, deletedAt: null, OR: [{ lastAssessedRulesetVersion: null }, { lastAssessedRulesetVersion: { lt: ruleset.version } }] },
      select: { id: true, monitoringStatus: true },
    });
    for (const p of partners) {
      await db.complianceEvent.create({
        data: {
          partnerId: p.id,
          marketId,
          type: "RULESET_REFLAG",
          severity: "MEDIUM",
          title: `Ruleset updated to v${ruleset.version} (${market.code})`,
          detail: { reference: imp.reference, toVersion: ruleset.version, changeNotes: wrapper.changeNotes ?? [] },
        },
      });
      if (p.monitoringStatus === "COMPLIANT") {
        await db.fleetPartner.update({
          where: { id: p.id },
          data: { monitoringStatus: "PENDING_REVIEW", monitoringReason: `Ruleset v${ruleset.version} requires re-validation` },
        });
      }
      reflagged++;
    }
  }

  invalidateRulesetCache(ruleset.marketCode);

  const activated = await db.regulatoryRuleset.findFirst({ where: { marketId, version: ruleset.version }, select: { id: true } });
  await db.rulesetImport.update({
    where: { id },
    data: { activatedRulesetId: activated?.id, activatedMarketId: marketId, reviewedByUserId: user.id, decidedAt: new Date() },
  });
  await setRegImportStatus(id, "ACTIVATED", { actorType: "HUMAN", actorUserId: user.id, reason: `Activated ${ruleset.marketCode} v${ruleset.version}` });
  await writeAudit({
    actorType: "HUMAN",
    actorUserId: user.id,
    action: "RULESET_ACTIVATED",
    entity: "Market",
    entityId: marketId!,
    after: { marketCode: ruleset.marketCode, version: ruleset.version, isNewMarket: imp.isNewMarket, reference: imp.reference, contentHash: hash, reflaggedPartners: reflagged },
  });

  return ok({ marketCode: ruleset.marketCode, version: ruleset.version, isNewMarket: imp.isNewMarket, reflagged });
}
