import { db } from "../../lib/db";
import type { Surface } from "../types/enums";
import { getPipeline } from "./registry";
import type { PipelineContext, StageIO } from "./types";
import { writeAudit } from "../governance/audit";

/**
 * Re-entrant pipeline runner. advanceOneStage() runs exactly ONE pending stage per call and
 * persists it, so a multi-stage AI pipeline never exceeds a single Vercel function's time limit.
 * The API layer schedules the next advance via after(); a cron/poll resume sweeper recovers
 * any run left RUNNING. Completed stages are immutable, so resuming is safe.
 */

export async function startPipeline(surface: Surface, entityId: string): Promise<string> {
  const pipeline = getPipeline(surface);
  const run = await db.pipelineRun.create({
    data: {
      surface,
      authorityRequestId: surface === "ARR" ? entityId : undefined,
      partnerId: surface === "B1" || surface === "B2" ? entityId : undefined,
      rulesetImportId: surface === "REGINTAKE" ? entityId : undefined,
      status: "QUEUED",
    },
  });
  await db.pipelineStage.createMany({
    data: pipeline.stages.map((s, i) => ({ runId: run.id, name: s.name, ordering: i, status: "PENDING" as const })),
  });

  // mark the entity as processing (ARR/B1 onboarding, REGINTAKE). B2 doesn't change onboarding status.
  if (surface === "ARR") {
    await db.authorityRequest.update({ where: { id: entityId }, data: { status: "PROCESSING", processingStartedAt: new Date() } });
  } else if (surface === "B1") {
    await db.fleetPartner.update({ where: { id: entityId }, data: { status: "PROCESSING" } });
  } else if (surface === "REGINTAKE") {
    await db.rulesetImport.update({ where: { id: entityId }, data: { status: "PROCESSING", processingStartedAt: new Date() } });
  }
  await writeAudit({ actorType: "SYSTEM", action: "PIPELINE_START", entity: "PipelineRun", entityId: run.id, after: { surface, entityId } });
  return run.id;
}

async function buildContext(runId: string): Promise<PipelineContext> {
  const run = await db.pipelineRun.findUniqueOrThrow({ where: { id: runId } });
  const startedAtMs = run.startedAt.getTime();
  if (run.surface === "REGINTAKE") {
    const imp = await db.rulesetImport.findUniqueOrThrow({ where: { id: run.rulesetImportId! } });
    return { runId, surface: "REGINTAKE", rulesetImportId: imp.id, startedAtMs, manualBaselineMinutes: imp.manualBaselineMinutes };
  }
  if (run.surface === "ARR") {
    const req = await db.authorityRequest.findUniqueOrThrow({
      where: { id: run.authorityRequestId! },
      include: { market: true },
    });
    return {
      runId,
      surface: "ARR",
      authorityRequestId: req.id,
      marketCode: req.market.code,
      marketId: req.marketId,
      rulesetVersion: req.market.activeRulesetVersion,
      startedAtMs,
      manualBaselineMinutes: req.manualBaselineMinutes,
    };
  }
  const partner = await db.fleetPartner.findUniqueOrThrow({ where: { id: run.partnerId! }, include: { market: true } });
  return {
    runId,
    surface: run.surface as "B1" | "B2",
    partnerId: partner.id,
    marketCode: partner.market.code,
    marketId: partner.marketId,
    rulesetVersion: partner.market.activeRulesetVersion,
    startedAtMs,
    manualBaselineMinutes: partner.manualBaselineMinutes,
  };
}

export interface AdvanceResult {
  runStatus: string;
  hasMore: boolean;
  ranStage?: string;
}

export async function advanceOneStage(runId: string): Promise<AdvanceResult> {
  const run = await db.pipelineRun.findUniqueOrThrow({ where: { id: runId }, include: { stages: { orderBy: { ordering: "asc" } } } });
  if (run.status === "COMPLETED" || run.status === "FAILED" || run.status === "AWAITING_REVIEW") {
    return { runStatus: run.status, hasMore: false };
  }
  const pipeline = getPipeline(run.surface as Surface);
  const next = run.stages.find((s) => s.status === "PENDING" || s.status === "RUNNING");
  if (!next) {
    await finishRun(run.id, run.surface as Surface, run.startedAt.getTime());
    return { runStatus: "COMPLETED", hasMore: false };
  }

  const stageDef = pipeline.stages.find((s) => s.name === next.name);
  if (!stageDef) throw new Error(`Stage ${next.name} not found in ${run.surface} pipeline`);

  // Atomically claim the stage (PENDING → RUNNING). If a concurrent/duplicate advance already
  // claimed it, claim.count === 0 and we return without re-running — prevents double execution
  // (and double AI spend). Stuck RUNNING stages are reset to PENDING by the resume sweeper.
  const claim = await db.pipelineStage.updateMany({
    where: { id: next.id, status: "PENDING" },
    data: { status: "RUNNING", startedAt: new Date(), progressPct: 5 },
  });
  if (claim.count === 0) {
    const fresh = await db.pipelineRun.findUnique({ where: { id: run.id }, select: { status: true } });
    return { runStatus: fresh?.status ?? "RUNNING", hasMore: !["COMPLETED", "FAILED", "AWAITING_REVIEW"].includes(fresh?.status ?? "") };
  }
  await db.pipelineRun.update({ where: { id: run.id }, data: { status: "RUNNING", currentStage: next.name } });

  const io: StageIO = {
    runId: run.id,
    emitProgress: async (pct, note) => {
      await db.pipelineStage.update({ where: { id: next.id }, data: { progressPct: Math.max(0, Math.min(100, Math.round(pct))), note } });
    },
  };

  const startedMs = Date.now();
  try {
    const ctx = await buildContext(run.id);
    const result = await stageDef.run(ctx, io);
    const durationMs = Date.now() - startedMs;

    if (result.blocked) {
      await db.pipelineStage.update({
        where: { id: next.id },
        data: { status: "BLOCKED", finishedAt: new Date(), durationMs, output: result.output as object, confidence: result.confidence, blockReason: result.blocked.reason, progressPct: 100 },
      });
      await db.pipelineRun.update({ where: { id: run.id }, data: { status: "AWAITING_REVIEW", statusReason: result.blocked.reason } });
      await routeEntityToReview(run.surface as Surface, run, result.blocked.reason);
      await writeAudit({ actorType: "AI", action: "PIPELINE_GATE_OPENED", entity: "PipelineRun", entityId: run.id, after: { stage: next.name, reason: result.blocked.reason } });
      return { runStatus: "AWAITING_REVIEW", hasMore: false, ranStage: next.name };
    }

    await db.pipelineStage.update({
      where: { id: next.id },
      data: { status: "DONE", finishedAt: new Date(), durationMs, output: result.output as object, confidence: result.confidence, progressPct: 100 },
    });

    const remaining = run.stages.filter((s) => s.id !== next.id && (s.status === "PENDING" || s.status === "RUNNING"));
    if (remaining.length === 0) {
      await finishRun(run.id, run.surface as Surface, run.startedAt.getTime());
      return { runStatus: "COMPLETED", hasMore: false, ranStage: next.name };
    }
    return { runStatus: "RUNNING", hasMore: true, ranStage: next.name };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.pipelineStage.update({ where: { id: next.id }, data: { status: "FAILED", finishedAt: new Date(), durationMs: Date.now() - startedMs, note: message } });
    await db.pipelineRun.update({ where: { id: run.id }, data: { status: "FAILED", statusReason: message } });
    await writeAudit({ actorType: "SYSTEM", action: "PIPELINE_FAILED", entity: "PipelineRun", entityId: run.id, after: { stage: next.name, error: message } });
    return { runStatus: "FAILED", hasMore: false, ranStage: next.name };
  }
}

async function finishRun(runId: string, surface: Surface, startedAtMs: number) {
  const elapsedMs = Date.now() - startedAtMs;
  const run = await db.pipelineRun.update({ where: { id: runId }, data: { status: "COMPLETED", endedAt: new Date(), elapsedMs, currentStage: null } });
  if (surface === "REGINTAKE" && run.rulesetImportId) {
    const imp = await db.rulesetImport.findUnique({ where: { id: run.rulesetImportId }, select: { status: true } });
    if (imp?.status === "PROCESSING") {
      await db.rulesetImport.update({ where: { id: run.rulesetImportId }, data: { status: "PENDING_REVIEW", processingEndedAt: new Date(), aiElapsedMs: elapsedMs } });
    }
  } else if (surface === "ARR" && run.authorityRequestId) {
    const req = await db.authorityRequest.findUnique({ where: { id: run.authorityRequestId }, select: { status: true } });
    if (req?.status === "PROCESSING") {
      await db.authorityRequest.update({ where: { id: run.authorityRequestId }, data: { status: "PENDING_REVIEW", processingEndedAt: new Date(), aiElapsedMs: elapsedMs } });
    }
  } else if (surface === "B1" && run.partnerId) {
    const p = await db.fleetPartner.findUnique({ where: { id: run.partnerId }, select: { status: true } });
    if (p?.status === "PROCESSING") {
      await db.fleetPartner.update({ where: { id: run.partnerId }, data: { status: "PENDING_REVIEW", aiElapsedMs: elapsedMs } });
    }
  }
  await writeAudit({ actorType: "SYSTEM", action: "PIPELINE_COMPLETED", entity: "PipelineRun", entityId: runId, after: { elapsedMs } });
}

async function routeEntityToReview(surface: Surface, run: { authorityRequestId: string | null; partnerId: string | null; rulesetImportId?: string | null }, reason: string) {
  if (surface === "REGINTAKE" && run.rulesetImportId) {
    const imp = await db.rulesetImport.findUnique({ where: { id: run.rulesetImportId }, select: { status: true } });
    if (imp?.status === "PROCESSING") {
      await db.rulesetImport.update({ where: { id: run.rulesetImportId }, data: { status: "PENDING_REVIEW", statusReason: reason, processingEndedAt: new Date() } });
    }
    return;
  }
  if (surface === "ARR" && run.authorityRequestId) {
    const req = await db.authorityRequest.findUnique({ where: { id: run.authorityRequestId }, select: { status: true } });
    if (req?.status === "PROCESSING") {
      await db.authorityRequest.update({ where: { id: run.authorityRequestId }, data: { status: "PENDING_REVIEW", statusReason: reason } });
    }
  } else if (surface === "B1" && run.partnerId) {
    const p = await db.fleetPartner.findUnique({ where: { id: run.partnerId }, select: { status: true } });
    if (p?.status === "PROCESSING") {
      await db.fleetPartner.update({ where: { id: run.partnerId }, data: { status: "PENDING_REVIEW" } });
    }
  }
}

/** Run all remaining stages to completion in one process (used by warm scripts + dev, not Vercel). */
export async function runToCompletion(runId: string, maxStages = 20): Promise<string> {
  let status = "RUNNING";
  for (let i = 0; i < maxStages; i++) {
    const r = await advanceOneStage(runId);
    status = r.runStatus;
    if (!r.hasMore) break;
  }
  return status;
}
