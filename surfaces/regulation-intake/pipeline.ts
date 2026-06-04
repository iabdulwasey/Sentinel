import { db } from "../../lib/db";
import { callLlm } from "../../engine/llm/client";
import { registerPipeline } from "../../engine/pipeline/registry";
import type { Stage, RegintakeContext } from "../../engine/pipeline/types";
import { getDocumentBase64 } from "../../engine/storage";
import { resolveRuleset } from "../../engine/rules/store";
import { validateRulesetSources } from "../../engine/rules/validate-sources";
import { diffRulesets } from "../../engine/rules/diff";
import {
  RegulationReadingSchema,
  RegulationClassificationSchema,
  RulesetSynthesisOutputSchema,
  RulesetValidationSchema,
  type RegulationReading,
  type RegulationClassification,
  type RulesetSynthesisOutput,
} from "../../engine/types/ai";
import { MarketRulesetSchema, type MarketRuleset } from "../../engine/types/ruleset";

/**
 * Surface C — Regulation Intake. Upload a regulation → AI proposes a complete, executable
 * MarketRuleset → a human reviews and activates. The draft is QUARANTINED on the RulesetImport
 * row; it never reaches the rules table until activation (see app/api/regulation-intake/.../activate).
 *
 * read → classify → synthesize → self-validate (schema parse + executor dry-run + adversarial) →
 * diff → finalize(→ PENDING_REVIEW). Re-entrant like every other surface.
 */

async function loadImport(id: string) {
  return db.rulesetImport.findUniqueOrThrow({ where: { id } });
}

const readStage: Stage<RegintakeContext> = {
  name: "read",
  label: "Read regulation",
  async run(ctx, io) {
    const imp = await loadImport(ctx.rulesetImportId);
    await io.emitProgress(20, "Reading the uploaded regulation");
    const documents = imp.storageRef ? [{ mediaType: imp.mimeType ?? "application/pdf", base64: await getDocumentBase64(imp.storageRef) }] : [];
    const res = await callLlm({
      agent: "RegulationReaderAgent",
      stage: "REG_READ",
      promptId: "regulation.read",
      schema: RegulationReadingSchema,
      schemaName: "RegulationReading",
      documents,
      maxTokens: 8000,
      vars: { note: imp.rawText ? imp.rawText.slice(0, 100000) : "" },
      link: { pipelineRunId: ctx.runId },
    });
    await db.rulesetImport.update({
      where: { id: imp.id },
      data: { reading: res.data as object, detectedCountry: res.data.detectedCountry ?? undefined, detectedRegulator: res.data.detectedRegulator ?? undefined },
    });
    return { output: { title: res.data.title, language: res.data.sourceLanguage, sections: res.data.sections.length, topics: res.data.topics }, confidence: res.data.confidence };
  },
};

const classifyStage: Stage<RegintakeContext> = {
  name: "classify",
  label: "Classify jurisdiction",
  async run(ctx, io) {
    const imp = await loadImport(ctx.rulesetImportId);
    const reading = imp.reading as unknown as RegulationReading | null;
    if (!reading) throw new Error("No regulation reading available.");
    await io.emitProgress(35, "Classifying jurisdiction & target market");
    const markets = await db.market.findMany({ where: { deletedAt: null }, select: { code: true, country: true, regulatorName: true } });
    const res = await callLlm({
      agent: "RegulationClassifierAgent",
      stage: "REG_CLASSIFY",
      promptId: "regulation.classify",
      schema: RegulationClassificationSchema,
      schemaName: "RegulationClassification",
      vars: {
        existingMarkets: markets.map((m) => `${m.code} · ${m.country} · ${m.regulatorName}`).join("\n"),
        title: reading.title,
        sourceLanguage: reading.sourceLanguage,
        detectedCountry: reading.detectedCountry ?? "",
        detectedRegulator: reading.detectedRegulator ?? "",
        summary: reading.summary,
        topics: reading.topics,
      },
      link: { pipelineRunId: ctx.runId },
    });
    const cls = res.data;
    let targetMarketId: string | null = null;
    let proposedVersion = 1;
    if (cls.matchesExistingMarketCode && !cls.isNewMarket) {
      const m = await db.market.findUnique({ where: { code: cls.matchesExistingMarketCode } });
      if (m) {
        targetMarketId = m.id;
        proposedVersion = m.activeRulesetVersion + 1;
      }
    }
    const isNewMarket = !targetMarketId;
    await db.rulesetImport.update({
      where: { id: imp.id },
      data: {
        classification: cls as object,
        detectedCountry: cls.country,
        detectedRegion: cls.region,
        detectedRegulator: cls.regulatorName,
        detectedRegime: cls.privacyRegime,
        targetMarketCode: isNewMarket ? cls.suggestedMarketCode : cls.matchesExistingMarketCode,
        targetMarketId,
        isNewMarket,
        proposedVersion,
      },
    });
    return {
      output: { country: cls.country, regime: cls.privacyRegime, isNewMarket, target: isNewMarket ? cls.suggestedMarketCode : cls.matchesExistingMarketCode, version: proposedVersion },
      confidence: cls.confidence,
    };
  },
};

const synthesizeStage: Stage<RegintakeContext> = {
  name: "synthesize",
  label: "Synthesize ruleset",
  async run(ctx, io) {
    const imp = await loadImport(ctx.rulesetImportId);
    const reading = imp.reading as unknown as RegulationReading;
    const cls = imp.classification as unknown as RegulationClassification;
    const marketCode = imp.targetMarketCode ?? cls.suggestedMarketCode;
    const version = imp.proposedVersion ?? 1;

    let priorRulesetNote = "This is a NEW market — there is no prior ruleset.";
    if (!imp.isNewMarket && imp.targetMarketCode) {
      try {
        const prior = await resolveRuleset(imp.targetMarketCode);
        priorRulesetNote = `This UPDATES an existing market. Keep stable ids/keys where the obligation is unchanged. Prior ruleset:\n${JSON.stringify(prior)}`;
      } catch {
        /* no prior content — treat as fresh synthesis */
      }
    }

    await io.emitProgress(25, "Synthesizing the market ruleset");
    const res = await callLlm({
      agent: "RulesetSynthesisAgent",
      stage: "RULESET_SYNTH",
      promptId: "ruleset.synthesize",
      schema: RulesetSynthesisOutputSchema,
      schemaName: "RulesetSynthesisOutput",
      maxTokens: 16000,
      vars: {
        marketCode,
        version,
        isNewMarket: imp.isNewMarket,
        country: cls.country,
        regulatorName: cls.regulatorName,
        regulatorCode: cls.regulatorCode,
        region: cls.region,
        privacyRegime: cls.privacyRegime,
        currency: cls.currency,
        locale: cls.locale,
        timezone: cls.timezone,
        cities: (cls.cities ?? []).join(", "),
        priorRulesetNote,
        sections: reading.sections.map((s) => `[${s.id}] ${s.heading}\n${s.text}`).join("\n\n"),
      },
      link: { pipelineRunId: ctx.runId },
    });
    const out = res.data;
    // Pin marketCode + version to the resolved target — never trust the model to echo them.
    out.ruleset.marketCode = marketCode;
    out.ruleset.version = version;
    await db.rulesetImport.update({ where: { id: imp.id }, data: { draftRuleset: out as object, confidence: out.overallConfidence } });
    return {
      output: { docs: out.ruleset.requiredDocuments.length, fields: out.ruleset.authorityFields.length, unmapped: out.unmappedFields.length, unsupported: out.unsupportedClauses.length },
      confidence: out.overallConfidence,
    };
  },
};

const validateStage: Stage<RegintakeContext> = {
  name: "self-validate",
  label: "Validate + dry-run",
  async run(ctx, io) {
    const imp = await loadImport(ctx.rulesetImportId);
    const wrapper = imp.draftRuleset as unknown as RulesetSynthesisOutput;
    const reading = imp.reading as unknown as RegulationReading;

    await io.emitProgress(30, "Schema parse + executor dry-run");
    const parsed = MarketRulesetSchema.safeParse(wrapper.ruleset);
    const schemaValid = parsed.success;
    const sources = parsed.success ? validateRulesetSources(parsed.data) : { ok: false, issues: [{ ref: "ruleset", severity: "HIGH" as const, message: "Draft does not parse against the MarketRuleset schema." }] };

    await io.emitProgress(65, "Adversarial review against the source");
    const res = await callLlm({
      agent: "ValidationAgent",
      stage: "RULESET_VALIDATE",
      promptId: "ruleset.validate",
      schema: RulesetValidationSchema,
      schemaName: "RulesetValidation",
      maxTokens: 4000,
      vars: {
        regulationSummary: reading.summary,
        topics: reading.topics,
        schemaValid,
        sourceIssues: sources.issues,
        unmappedFields: wrapper.unmappedFields,
        unsupportedClauses: wrapper.unsupportedClauses,
        draftRuleset: wrapper.ruleset,
      },
      link: { pipelineRunId: ctx.runId },
    });
    const blocking = !schemaValid || !sources.ok || res.data.blocking;
    const combined = { ...res.data, schemaValid, sourceCheck: sources, blocking };
    await db.rulesetImport.update({ where: { id: imp.id }, data: { validation: combined as object } });
    return { output: { schemaValid, sourcesOk: sources.ok, issues: res.data.issues.length, blocking }, confidence: res.data.overallConfidence };
  },
};

const diffStage: Stage<RegintakeContext> = {
  name: "diff",
  label: "Diff vs current",
  async run(ctx) {
    const imp = await loadImport(ctx.rulesetImportId);
    const wrapper = imp.draftRuleset as unknown as RulesetSynthesisOutput;
    if (imp.isNewMarket || !imp.targetMarketCode) {
      await db.rulesetImport.update({ where: { id: imp.id }, data: { diff: { isNewMarket: true, summary: "New market — no prior version to diff." } as object } });
      return { output: { isNewMarket: true }, confidence: 1 };
    }
    let prior: MarketRuleset | null = null;
    try {
      prior = await resolveRuleset(imp.targetMarketCode);
    } catch {
      /* no prior */
    }
    const d = prior ? diffRulesets(prior, wrapper.ruleset) : { summary: "No prior version found." };
    await db.rulesetImport.update({ where: { id: imp.id }, data: { diff: d as object } });
    return { output: { summary: d.summary }, confidence: 1 };
  },
};

const finalizeStage: Stage<RegintakeContext> = {
  name: "finalize",
  label: "Ready for review",
  async run(ctx) {
    const imp = await loadImport(ctx.rulesetImportId);
    const wrapper = imp.draftRuleset as unknown as RulesetSynthesisOutput | null;
    // The runner transitions the import to PENDING_REVIEW on completion; a human activates.
    return { output: { proposedMarket: imp.targetMarketCode, version: imp.proposedVersion, isNewMarket: imp.isNewMarket }, confidence: imp.confidence ?? wrapper?.overallConfidence ?? 1 };
  },
};

export const REGINTAKE_PIPELINE = {
  surface: "REGINTAKE" as const,
  stages: [readStage, classifyStage, synthesizeStage, validateStage, diffStage, finalizeStage] as Stage<RegintakeContext>[],
};

registerPipeline(REGINTAKE_PIPELINE as never);
