/**
 * Backfill validation, cross-check, risk-assessment, and decision records for
 * seeded APPROVED/CONDITIONS_APPLIED/REJECTED partners that were created without
 * running the B1 pipeline. Uses ground-truth field values (same source the pipeline
 * would have extracted) and the exact same DSL evaluators.
 *
 *   npx tsx scripts/backfill-b1-artifacts.ts
 */
import { db } from "../lib/db";
import { resolveRuleset } from "../engine/rules/store";
import { evaluateValidation, evaluateCrossCheck } from "../engine/validation/rules";
import { getAsOf } from "../lib/anchor";
import { rng } from "../prisma/seed-lib/data";

async function main() {
  const asOf = await getAsOf();

  // Partners that are decided/approved but have no pipeline artifacts
  const partners = await db.fleetPartner.findMany({
    where: {
      deletedAt: null,
      status: { in: ["APPROVED", "CONDITIONS_APPLIED", "REJECTED"] },
      validations: { none: {} },
      riskAssessments: { none: {} },
    },
    include: {
      market: true,
      documents: {
        where: { deletedAt: null },
        include: { groundTruth: true },
      },
    },
  });

  console.log(`Backfilling ${partners.length} partners…`);
  let ok = 0;

  for (const partner of partners) {
    try {
      const ruleset = await resolveRuleset(partner.market.code, partner.market.activeRulesetVersion);
      const r = rng(partner.reference.split("").reduce((a, c) => a + c.charCodeAt(0), 0));

      // Build a field map per document from ground truth (what extraction would have found)
      const byType = new Map<string, { id: string; fields: Record<string, string | null>; confidence: number }>();
      for (const doc of partner.documents) {
        const gt = (doc.groundTruth?.fields as Record<string, string> | null) ?? {};
        const fields: Record<string, string | null> = {};
        for (const [k, v] of Object.entries(gt)) fields[k] = v;
        byType.set(doc.docType, { id: doc.id, fields, confidence: doc.extractionConfidence ?? 0.92 });
      }

      // Validations
      let fails = 0;
      let warns = 0;
      const validationRows: Parameters<typeof db.validation.create>[0]["data"][] = [];
      for (const spec of ruleset.requiredDocuments) {
        const doc = byType.get(spec.docType);
        if (!doc) continue;
        for (const rule of spec.validations) {
          const result = evaluateValidation(rule, doc.fields, asOf);
          if (result.outcome === "FAIL") fails++;
          if (result.outcome === "WARN") warns++;
          validationRows.push({
            ruleId: rule.id,
            scope: "DOCUMENT",
            documentId: doc.id,
            partnerId: partner.id,
            outcome: result.outcome,
            severity: rule.severity,
            message: result.outcome === "PASS" ? rule.description : result.message,
            evidence: result.evidence as object,
            confidence: doc.confidence,
          });
        }
      }
      await db.validation.createMany({ data: validationRows as never });

      // Cross-checks
      let mismatches = 0;
      const crossRows: Parameters<typeof db.crossCheck.create>[0]["data"][] = [];
      for (const check of ruleset.crossDocumentChecks) {
        const docA = byType.get(check.docTypeA);
        const docB = byType.get(check.docTypeB);
        if (!docA || !docB) continue;
        const result = evaluateCrossCheck(check, docA.fields, docB.fields);
        if (result.outcome === "MISMATCH") mismatches++;
        crossRows.push({
          partnerId: partner.id,
          checkId: check.id,
          docAId: docA.id,
          docBId: docB.id,
          field: check.fieldA,
          valueA: result.valueA,
          valueB: result.valueB,
          outcome: result.outcome,
          message: result.message,
          confidence: Math.min(docA.confidence, docB.confidence),
        });
      }
      if (crossRows.length) await db.crossCheck.createMany({ data: crossRows as never });

      // Risk assessment — deterministic from the ruleset's riskModel weights
      const riskModel = ruleset.riskModel;
      const factors = riskModel.factors.map((f) => {
        let contrib = 0;
        if (f.id === "document_completeness") {
          const docCount = partner.documents.length;
          const req = ruleset.requiredDocuments.filter(d => d.requiredFor.includes(partner.partnerType as never)).length;
          const missing = Math.max(0, req - docCount);
          contrib = Math.round(missing * f.weight * 20);
        } else if (f.id === "validation_failures") {
          contrib = Math.round(fails * f.weight * 15);
        } else if (f.id === "cross_check_mismatches") {
          contrib = Math.round(mismatches * f.weight * 25);
        } else if (f.id === "document_age") {
          contrib = Math.round(r() * f.weight * 10);
        } else {
          contrib = Math.round(r() * f.weight * 8);
        }
        return { id: f.id, label: f.label, weight: f.weight, contribution: Math.min(contrib, 40) };
      });
      const rawScore = factors.reduce((s, f) => s + f.contribution, 0);
      const score = Math.max(5, Math.min(100, rawScore));
      const band =
        score >= (riskModel.bands.high?.[0] ?? 70) ? "HIGH"
        : score >= (riskModel.bands.medium?.[0] ?? 40) ? "MEDIUM"
        : "LOW";
      const explanation = `${fails} validation failure${fails !== 1 ? "s" : ""}, ${mismatches} cross-check mismatch${mismatches !== 1 ? "es" : ""}. Overall ${band.toLowerCase()} risk based on the ${ruleset.country} market ruleset.`;

      const rulesetRow = await db.regulatoryRuleset.findFirst({
        where: { marketId: partner.marketId, version: partner.market.activeRulesetVersion },
      });

      await db.riskAssessment.create({
        data: {
          partnerId: partner.id,
          rulesetId: rulesetRow?.id,
          rulesetVersion: partner.market.activeRulesetVersion,
          score,
          band,
          factors: factors as object,
          explanation,
          isCurrent: true,
        },
      });
      await db.fleetPartner.update({
        where: { id: partner.id },
        data: { riskScore: score, riskBand: band },
      });

      // Decision — match the partner's actual status
      const outcome =
        partner.status === "APPROVED" ? "APPROVE"
        : partner.status === "CONDITIONS_APPLIED" ? "APPROVE_WITH_CONDITIONS"
        : "REJECT";
      const conditions: string[] = [];
      if (outcome === "APPROVE_WITH_CONDITIONS") {
        if (warns > 0) conditions.push(`Resolve ${warns} outstanding validation warning${warns > 1 ? "s" : ""} within 30 days.`);
        conditions.push("Re-submit any expiring documents at least 14 days before expiry.");
      }
      const rationale =
        outcome === "REJECT"
          ? `Partner rejected due to ${fails} critical validation failure${fails !== 1 ? "s" : ""} that could not be resolved.`
          : outcome === "APPROVE_WITH_CONDITIONS"
          ? `Partner approved with conditions. ${warns} warning${warns !== 1 ? "s" : ""} must be resolved. Risk band: ${band}.`
          : `All required documents validated. ${fails === 0 ? "No validation failures." : `${fails} minor issue${fails !== 1 ? "s" : ""} resolved.`} Risk band: ${band}.`;

      await db.fleetPartner.update({
        where: { id: partner.id },
        data: {
          decision: {
            outcome,
            conditions,
            rationale,
            confidence: fails === 0 && mismatches === 0 ? 0.92 : 0.78,
            draft: false,
          } as object,
        },
      });

      ok++;
    } catch (e) {
      console.error(`  ✗ ${partner.reference}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`Done. ${ok}/${partners.length} partners backfilled.`);
  process.exit(0);
}

main();
