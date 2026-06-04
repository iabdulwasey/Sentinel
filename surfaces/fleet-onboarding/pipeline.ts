import { addDays } from "date-fns";
import { db } from "../../lib/db";
import { resolveRuleset } from "../../engine/rules/store";
import { callLlm } from "../../engine/llm/client";
import { registerPipeline } from "../../engine/pipeline/registry";
import type { Stage, B1Context } from "../../engine/pipeline/types";
import { getDocumentBase64 } from "../../engine/storage";
import { getAsOf } from "../../lib/anchor";
import { evaluateValidation, evaluateCrossCheck } from "../../engine/validation/rules";
import {
  ExtractionResultSchema,
  RiskAssessmentResultSchema,
  OnboardingDecisionSchema,
  type ExtractionResult,
} from "../../engine/types/ai";
import type { MarketRuleset } from "../../engine/types/ruleset";

/**
 * Surface B1 — Fleet Partner Onboarding pipeline.
 * extraction (AI, native PDF) → validation + cross-checks (deterministic DSL) →
 * risk (AI) → decision draft (AI). Completes to PENDING_REVIEW for a human to decide.
 */

function ruleOf(code: string, version: number): Promise<MarketRuleset> {
  return resolveRuleset(code, version);
}
function fieldMap(er: ExtractionResult | null): Record<string, string | null> {
  const m: Record<string, string | null> = {};
  for (const f of er?.fields ?? []) m[f.key] = f.value ?? null;
  return m;
}

const extractionStage: Stage<B1Context> = {
  name: "extraction",
  label: "Document extraction",
  async run(ctx, io) {
    const ruleset = await ruleOf(ctx.marketCode, ctx.rulesetVersion);
    const docs = await db.document.findMany({ where: { partnerId: ctx.partnerId, deletedAt: null } });
    const specByType = new Map(ruleset.requiredDocuments.map((d) => [d.docType, d]));
    let done = 0;
    const confs: number[] = [];
    await Promise.all(
      docs.map(async (doc) => {
        const spec = specByType.get(doc.docType);
        const base64 = await getDocumentBase64(doc.storageRef);
        const res = await callLlm({
          agent: "ExtractionAgent",
          stage: "DOC_EXTRACTION",
          promptId: "extraction.fields",
          schema: ExtractionResultSchema,
          schemaName: "ExtractionResult",
          maxTokens: 2500,
          documents: [{ mediaType: doc.mimeType, base64 }],
          vars: {
            docType: doc.docType,
            docLabel: spec?.label ?? doc.title,
            expectedFields: (spec?.expectedFields ?? []).map((f) => ({ key: f.key, label: f.label, type: f.type })),
          },
          link: { partnerId: ctx.partnerId, documentId: doc.id, pipelineRunId: ctx.runId },
        });
        const er = res.data;
        const lowConf = er.overallConfidence < 0.7 || er.fields.some((f) => f.present && f.confidence < 0.6);
        await db.document.update({
          where: { id: doc.id },
          data: { extractedFields: er as object, extractionConfidence: er.overallConfidence, status: lowConf ? "FLAGGED" : "EXTRACTED" },
        });
        confs.push(er.overallConfidence);
        done++;
        await io.emitProgress(Math.round((done / Math.max(1, docs.length)) * 100), `Extracted ${done}/${docs.length} documents`);
      }),
    );
    const avg = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 1;
    return { output: { documents: docs.length, avgConfidence: avg, flagged: confs.filter((c) => c < 0.7).length }, confidence: avg };
  },
};

const validationStage: Stage<B1Context> = {
  name: "validation",
  label: "Validation & cross-checks",
  async run(ctx, io) {
    const ruleset = await ruleOf(ctx.marketCode, ctx.rulesetVersion);
    const partner = await db.fleetPartner.findUniqueOrThrow({ where: { id: ctx.partnerId } });
    const docs = await db.document.findMany({ where: { partnerId: ctx.partnerId, deletedAt: null } });
    const asOf = await getAsOf();
    const byType = new Map(docs.map((d) => [d.docType, d]));

    await db.validation.deleteMany({ where: { partnerId: ctx.partnerId } });
    await db.crossCheck.deleteMany({ where: { partnerId: ctx.partnerId } });

    let fails = 0;
    await io.emitProgress(30, "Validating documents against market rules");
    for (const spec of ruleset.requiredDocuments) {
      const doc = byType.get(spec.docType);
      if (!doc) continue;
      const fields = fieldMap(doc.extractedFields as unknown as ExtractionResult | null);
      for (const rule of spec.validations) {
        const result = evaluateValidation(rule, fields, asOf);
        if (result.outcome === "FAIL") fails++;
        await db.validation.create({
          data: {
            ruleId: rule.id,
            scope: "DOCUMENT",
            documentId: doc.id,
            partnerId: ctx.partnerId,
            outcome: result.outcome,
            severity: rule.severity,
            message: result.outcome === "PASS" ? rule.description : result.message,
            evidence: result.evidence as object,
            confidence: doc.extractionConfidence,
          },
        });
      }
    }

    await io.emitProgress(70, "Cross-checking across documents");
    let mismatches = 0;
    for (const check of ruleset.crossDocumentChecks) {
      const docA = byType.get(check.docTypeA);
      const docB = byType.get(check.docTypeB);
      if (!docA || !docB) continue;
      const fa = fieldMap(docA.extractedFields as unknown as ExtractionResult | null);
      const fb = fieldMap(docB.extractedFields as unknown as ExtractionResult | null);
      const result = evaluateCrossCheck(check, fa, fb);
      if (result.outcome === "MISMATCH") mismatches++;
      await db.crossCheck.create({
        data: {
          partnerId: ctx.partnerId,
          checkId: check.id,
          docAId: docA.id,
          docBId: docB.id,
          field: check.fieldA,
          valueA: result.valueA,
          valueB: result.valueB,
          outcome: result.outcome,
          message: result.message,
          confidence: Math.min(docA.extractionConfidence ?? 1, docB.extractionConfidence ?? 1),
        },
      });
    }

    // required-document completeness for this partner type
    const required = ruleset.requiredDocuments.filter((d) => !d.optional && d.requiredFor.includes(partner.partnerType as never));
    const presentTypes = new Set(docs.map((d) => d.docType));
    const missing = required.filter((d) => !presentTypes.has(d.docType)).map((d) => d.docType);
    const completenessPct = Math.round(((required.length - missing.length) / Math.max(1, required.length)) * 100);
    await db.fleetPartner.update({ where: { id: ctx.partnerId }, data: { completenessPct } });

    return { output: { validationFails: fails, crossCheckMismatches: mismatches, missingDocs: missing, completenessPct }, confidence: 1 };
  },
};

const riskStage: Stage<B1Context> = {
  name: "risk",
  label: "Risk scoring",
  async run(ctx, io) {
    const ruleset = await ruleOf(ctx.marketCode, ctx.rulesetVersion);
    const partner = await db.fleetPartner.findUniqueOrThrow({ where: { id: ctx.partnerId } });
    const asOf = await getAsOf();
    const horizon = addDays(asOf, 30);

    const [docs, vehicles, drivers, fails, warns, mismatches, lowConfDocs] = await Promise.all([
      db.document.findMany({ where: { partnerId: ctx.partnerId, deletedAt: null }, select: { docType: true, expiresAt: true, extractionConfidence: true } }),
      db.vehicle.count({ where: { partnerId: ctx.partnerId, deletedAt: null } }),
      db.driver.count({ where: { partnerId: ctx.partnerId, deletedAt: null } }),
      db.validation.count({ where: { partnerId: ctx.partnerId, outcome: "FAIL" } }),
      db.validation.count({ where: { partnerId: ctx.partnerId, outcome: "WARN" } }),
      db.crossCheck.count({ where: { partnerId: ctx.partnerId, outcome: "MISMATCH" } }),
      db.document.count({ where: { partnerId: ctx.partnerId, extractionConfidence: { lt: 0.7 } } }),
    ]);
    const expiringSoon = docs.filter((d) => d.expiresAt && d.expiresAt >= asOf && d.expiresAt <= horizon).length;
    const expired = docs.filter((d) => d.expiresAt && d.expiresAt < asOf).length;

    await io.emitProgress(50, "Scoring partner risk");
    const res = await callLlm({
      agent: "RiskAgent",
      stage: "RISK_SCORE",
      promptId: "risk.score",
      schema: RiskAssessmentResultSchema,
      schemaName: "RiskAssessmentResult",
      vars: {
        partnerName: partner.legalName,
        partnerType: partner.partnerType,
        marketName: ruleset.country,
        riskModel: ruleset.riskModel,
        signals: { completenessPct: partner.completenessPct, validationFails: fails, validationWarnings: warns, crossCheckMismatches: mismatches, expiringWithin30d: expiringSoon, expiredDocuments: expired, lowConfidenceDocuments: lowConfDocs, vehicles, drivers },
      },
      link: { partnerId: ctx.partnerId, pipelineRunId: ctx.runId },
    });
    const risk = res.data;
    await db.riskAssessment.updateMany({ where: { partnerId: ctx.partnerId, isCurrent: true }, data: { isCurrent: false } });
    await db.riskAssessment.create({
      data: { partnerId: ctx.partnerId, rulesetVersion: ctx.rulesetVersion, score: risk.score, band: risk.band, factors: risk.factors as object, explanation: risk.explanation, isCurrent: true },
    });
    await db.fleetPartner.update({ where: { id: ctx.partnerId }, data: { riskScore: risk.score, riskBand: risk.band } });
    return { output: { score: risk.score, band: risk.band, factors: risk.factors.length }, confidence: risk.confidence };
  },
};

const decisionStage: Stage<B1Context> = {
  name: "decision",
  label: "Decision draft",
  async run(ctx, io) {
    const ruleset = await ruleOf(ctx.marketCode, ctx.rulesetVersion);
    const partner = await db.fleetPartner.findUniqueOrThrow({ where: { id: ctx.partnerId } });
    const [validations, crossChecks, risk, docs] = await Promise.all([
      db.validation.findMany({ where: { partnerId: ctx.partnerId }, select: { ruleId: true, outcome: true, severity: true, message: true } }),
      db.crossCheck.findMany({ where: { partnerId: ctx.partnerId }, select: { checkId: true, outcome: true, valueA: true, valueB: true, message: true } }),
      db.riskAssessment.findFirst({ where: { partnerId: ctx.partnerId, isCurrent: true } }),
      db.document.findMany({ where: { partnerId: ctx.partnerId, deletedAt: null }, select: { docType: true, status: true, extractionConfidence: true } }),
    ]);
    const required = ruleset.requiredDocuments.filter((d) => !d.optional && d.requiredFor.includes(partner.partnerType as never));
    const presentTypes = new Set(docs.map((d) => d.docType));
    const checklist = required.map((d) => ({ docType: d.docType, present: presentTypes.has(d.docType) }));

    await io.emitProgress(50, "Drafting the onboarding decision");
    const res = await callLlm({
      agent: "GenerationAgent",
      stage: "DECISION_DRAFT",
      promptId: "generation.onboarding",
      schema: OnboardingDecisionSchema,
      schemaName: "OnboardingDecision",
      vars: {
        marketName: ruleset.country,
        partnerName: partner.legalName,
        partnerType: partner.partnerType,
        checklist,
        validations: validations.filter((v) => v.outcome !== "PASS"),
        crossChecks,
        risk: risk ? { score: risk.score, band: risk.band, explanation: risk.explanation } : null,
      },
      link: { partnerId: ctx.partnerId, pipelineRunId: ctx.runId },
    });
    await db.fleetPartner.update({ where: { id: ctx.partnerId }, data: { decision: { ...res.data, draft: true } as object } });
    return { output: res.data, confidence: res.data.confidence };
  },
};

export const B1_PIPELINE = {
  surface: "B1" as const,
  stages: [extractionStage, validationStage, riskStage, decisionStage] as Stage<B1Context>[],
};

registerPipeline(B1_PIPELINE as never);
