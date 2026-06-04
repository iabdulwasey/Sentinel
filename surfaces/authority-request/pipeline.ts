import { db } from "../../lib/db";
import { resolveRuleset } from "../../engine/rules/store";
import { callLlm } from "../../engine/llm/client";
import { registerPipeline } from "../../engine/pipeline/registry";
import type { Stage, ArrContext } from "../../engine/pipeline/types";
import { executeRetrieval } from "../../engine/retrieval/executor";
import { enforceCompliance } from "../../engine/compliance/checks";
import { verifyReport } from "../../engine/accuracy/verify";
import { setArrStatus } from "../../engine/governance/state";
import {
  RequestIntentSchema,
  CompliancePlanSchema,
  RetrievalPlanSchema,
  GeneratedReportSchema,
  SelfValidationSchema,
  type RequestIntent,
  type CompliancePlan,
  type RetrievalComputedField,
  type GeneratedReport,
} from "../../engine/types/ai";
import type { MarketRuleset } from "../../engine/types/ruleset";

/**
 * Surface A — Authority Request Response pipeline. Each stage reads prior results from the
 * AuthorityRequest row, calls one agent (or the deterministic executor/compliance/verify
 * engines), and persists its output. Re-entrant: safe to resume one stage at a time.
 */

async function asOfString(): Promise<string> {
  const meta = await db.appMeta.findUnique({ where: { key: "seedAnchor" } });
  const v = meta?.value as { date?: string } | null;
  return (v?.date ?? new Date().toISOString()).slice(0, 10);
}

async function loadReq(id: string) {
  return db.authorityRequest.findUniqueOrThrow({ where: { id }, include: { market: true } });
}

function ruleOf(marketCode: string, version: number): Promise<MarketRuleset> {
  return resolveRuleset(marketCode, version);
}

const intakeStage: Stage<ArrContext> = {
  name: "intake",
  label: "Intake → Intent",
  async run(ctx, io) {
    const req = await loadReq(ctx.authorityRequestId);
    const ruleset = await ruleOf(ctx.marketCode, ctx.rulesetVersion);
    await io.emitProgress(30, "Reading the authority request");
    const res = await callLlm({
      agent: "IntakeAgent",
      stage: "INTAKE",
      promptId: "intake.request",
      schema: RequestIntentSchema,
      schemaName: "RequestIntent",
      vars: { marketName: `${ruleset.country}`, regulator: ruleset.regulator.name, asOf: await asOfString(), rawText: req.rawText ?? "" },
      link: { authorityRequestId: req.id, pipelineRunId: ctx.runId },
    });
    const intent = res.data;
    await db.authorityRequest.update({ where: { id: req.id }, data: { intent: intent as object } });
    if (intent.ambiguities && intent.ambiguities.length > 0) {
      await setArrStatus(req.id, "NEEDS_CLARIFICATION", { actorType: "AI", reason: intent.ambiguities.join("; ") });
      return { output: intent, confidence: intent.confidence, blocked: { reason: `Clarification needed: ${intent.ambiguities.join("; ")}` } };
    }
    return { output: intent, confidence: intent.confidence };
  },
};

const ruleMappingStage: Stage<ArrContext> = {
  name: "rule-mapping",
  label: "Rule mapping → Compliance plan",
  async run(ctx, io) {
    const req = await loadReq(ctx.authorityRequestId);
    const ruleset = await ruleOf(ctx.marketCode, ctx.rulesetVersion);
    const intent = req.intent as unknown as RequestIntent;
    await io.emitProgress(40, "Interpreting the market ruleset");
    const res = await callLlm({
      agent: "RuleMappingAgent",
      stage: "RULE_MAPPING",
      promptId: "rules.interpret",
      schema: CompliancePlanSchema,
      schemaName: "CompliancePlan",
      cacheableContext: JSON.stringify({ authorityFields: ruleset.authorityFields, compliancePolicy: ruleset.compliancePolicy, reportFormat: ruleset.reportFormat }),
      vars: {
        marketName: ruleset.country,
        regulator: ruleset.regulator.name,
        intent,
        authorityFields: ruleset.authorityFields.map((f) => ({ key: f.key, classification: f.classification, dataClass: f.dataClass, cautionNote: f.cautionNote })),
        compliancePolicy: ruleset.compliancePolicy,
        reportFormat: { formatId: ruleset.reportFormat.formatId, sections: ruleset.reportFormat.sections, dateFormat: ruleset.reportFormat.dateFormat, language: ruleset.reportFormat.language },
      },
      link: { authorityRequestId: req.id, pipelineRunId: ctx.runId },
    });
    await db.authorityRequest.update({ where: { id: req.id }, data: { compliancePlan: res.data as object } });
    return { output: res.data, confidence: res.data.confidence };
  },
};

const retrievalPlanStage: Stage<ArrContext> = {
  name: "retrieval-plan",
  label: "Retrieval planning",
  async run(ctx, io) {
    const req = await loadReq(ctx.authorityRequestId);
    const ruleset = await ruleOf(ctx.marketCode, ctx.rulesetVersion);
    const intent = req.intent as unknown as RequestIntent;
    const plan = req.compliancePlan as unknown as CompliancePlan;
    await io.emitProgress(50, "Planning the data retrieval");
    const res = await callLlm({
      agent: "RetrievalPlannerAgent",
      stage: "RETRIEVAL_PLAN",
      promptId: "retrieval.plan",
      schema: RetrievalPlanSchema,
      schemaName: "RetrievalPlan",
      vars: { intent, compliancePlan: plan, availableFieldKeys: ruleset.authorityFields.map((f) => f.key) },
      link: { authorityRequestId: req.id, pipelineRunId: ctx.runId },
    });
    await db.authorityRequest.update({ where: { id: req.id }, data: { retrievalPlan: res.data as object } });
    return { output: res.data, confidence: res.data.confidence };
  },
};

const retrievalExecStage: Stage<ArrContext> = {
  name: "retrieval-exec",
  label: "Retrieval + compliance",
  async run(ctx, io) {
    const req = await loadReq(ctx.authorityRequestId);
    const ruleset = await ruleOf(ctx.marketCode, ctx.rulesetVersion);
    const intent = req.intent as unknown as RequestIntent;
    const plan = req.compliancePlan as unknown as CompliancePlan;
    // authoritative field set: compliance-plan fields not out-of-scope, mapped to ruleset keys
    const fieldKeys = Array.from(
      new Set(
        plan.fields
          .filter((f) => f.classification !== "OUT_OF_SCOPE" && f.mappedFieldKey)
          .map((f) => f.mappedFieldKey as string),
      ),
    );
    await io.emitProgress(45, "Querying the operational datastore");
    const raw = await executeRetrieval({ ruleset, marketId: ctx.marketId, intent, fieldKeys });
    await io.emitProgress(75, "Applying compliance constraints");
    const enforced = await enforceCompliance({ ruleset, intent, fields: raw.fields, link: { authorityRequestId: req.id } });
    const result = { fields: enforced.fields, decisions: enforced.decisions, withheld: enforced.withheld, rowSamples: raw.rowSamples };
    await db.authorityRequest.update({ where: { id: req.id }, data: { retrievalResult: result as object } });
    return {
      output: { fieldCount: enforced.fields.length, withheld: enforced.withheld, decisions: enforced.decisions },
      confidence: 1,
    };
  },
};

const generationStage: Stage<ArrContext> = {
  name: "generation",
  label: "Report generation",
  async run(ctx, io) {
    const req = await loadReq(ctx.authorityRequestId);
    const ruleset = await ruleOf(ctx.marketCode, ctx.rulesetVersion);
    const plan = req.compliancePlan as unknown as CompliancePlan;
    const retrieval = req.retrievalResult as unknown as { fields: RetrievalComputedField[]; decisions: unknown[]; withheld: string[] };
    const fields = retrieval.fields ?? [];
    const scalarFields = fields.filter((f) => typeof f.value === "number" || typeof f.value === "string");

    await io.emitProgress(40, "Drafting the compliant report");
    const datasetForModel = scalarFields.map((f) => ({
      fieldKey: f.fieldKey,
      label: f.label,
      value: f.value,
      classification: f.classification,
      sourceRowIds: f.provenance[0]?.ids ?? [],
      derivation: f.provenance[0]?.filterDescription,
      constraintApplied: f.constraintApplied ?? null,
    }));
    const res = await callLlm({
      agent: "GenerationAgent",
      stage: "REPORT_GEN",
      promptId: "generation.report",
      schema: GeneratedReportSchema,
      schemaName: "GeneratedReport",
      maxTokens: 6000,
      vars: {
        marketName: ruleset.country,
        regulator: ruleset.regulator.name,
        language: ruleset.reportFormat.language,
        reportFormat: ruleset.reportFormat,
        compliancePlan: { checklist: plan.checklist, notes: plan.notes, withheld: retrieval.withheld },
        dataset: datasetForModel,
      },
      link: { authorityRequestId: req.id, pipelineRunId: ctx.runId },
    });
    const report = res.data;
    await db.authorityRequest.update({ where: { id: req.id }, data: { generatedReport: report as object } });

    // create normalized provenance rows for ALL fields (scalars + lists)
    await db.reportField.deleteMany({ where: { authorityRequestId: req.id } });
    await db.reportField.createMany({
      data: fields.map((f, i) => ({
        authorityRequestId: req.id,
        fieldKey: f.fieldKey,
        label: f.label,
        value: f.value as object,
        unit: undefined,
        classification: f.classification,
        confidence: report.confidence,
        verified: false,
        provenance: f.provenance as object,
        aiCallId: res.aiCallId,
        ordering: i,
      })),
    });
    return { output: { title: report.title, sectionCount: report.sections.length, figureCount: report.figures.length }, confidence: report.confidence };
  },
};

const selfValidationStage: Stage<ArrContext> = {
  name: "self-validation",
  label: "Self-validation + confidence",
  async run(ctx, io) {
    const req = await loadReq(ctx.authorityRequestId);
    const plan = req.compliancePlan as unknown as CompliancePlan;
    const retrieval = req.retrievalResult as unknown as { fields: RetrievalComputedField[] };
    const report = req.generatedReport as unknown as GeneratedReport;

    await io.emitProgress(40, "Verifying every figure against source");
    const verify = verifyReport(report, retrieval.fields ?? []);

    await io.emitProgress(70, "Cross-checking against the compliance checklist");
    const res = await callLlm({
      agent: "ValidationAgent",
      stage: "SELF_VALIDATION",
      promptId: "validation.selfcheck",
      schema: SelfValidationSchema,
      schemaName: "SelfValidation",
      vars: {
        checklist: plan.checklist,
        dataset: (retrieval.fields ?? []).map((f) => ({ fieldKey: f.fieldKey, value: f.value })),
        report: { title: report.title, figures: report.figures, sections: report.sections.map((s) => ({ heading: s.heading, body: s.body })) },
      },
      link: { authorityRequestId: req.id, pipelineRunId: ctx.runId },
    });

    const combined = { ...res.data, figureVerification: verify, allFiguresVerified: verify.allVerified };
    await db.authorityRequest.update({ where: { id: req.id }, data: { selfValidation: combined as object } });

    // mark verified flags on the report fields
    for (const r of verify.results) {
      await db.reportField.updateMany({ where: { authorityRequestId: req.id, fieldKey: r.fieldKey }, data: { verified: r.verified } });
    }
    return {
      output: { allFiguresVerified: verify.allVerified, unverified: verify.unverifiedKeys, blocking: res.data.blocking, overallConfidence: res.data.overallConfidence },
      confidence: res.data.overallConfidence,
    };
  },
};

export const ARR_PIPELINE = {
  surface: "ARR" as const,
  stages: [intakeStage, ruleMappingStage, retrievalPlanStage, retrievalExecStage, generationStage, selfValidationStage] as Stage<ArrContext>[],
};

registerPipeline(ARR_PIPELINE as never);
