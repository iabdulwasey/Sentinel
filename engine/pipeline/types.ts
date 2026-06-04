import type { Surface } from "../types/enums";

/**
 * A pipeline = ordered typed stages. Stages are RE-ENTRANT: the context carries only ids +
 * metadata; each stage reads prior results from the DB (the entity's JSON columns / prior
 * PipelineStage.output), does its work, and persists its result. This makes any stage
 * independently resumable, which is what keeps multi-stage AI pipelines within Vercel's
 * per-invocation time limit (one stage per invocation).
 */
export interface StageContextBase {
  runId: string;
  surface: Surface;
  marketCode: string;
  marketId: string;
  rulesetVersion: number;
  startedAtMs: number;
  manualBaselineMinutes: number;
}

export interface ArrContext extends StageContextBase {
  surface: "ARR";
  authorityRequestId: string;
}
export interface B1Context extends StageContextBase {
  surface: "B1";
  partnerId: string;
}
export interface B2Context extends StageContextBase {
  surface: "B2";
  partnerId: string;
}
/** Surface C — Regulation Intake. A run may have NO market yet (new-market imports), so this
 *  context is NOT market-bound; stages read the RulesetImport row for everything they need. */
export interface RegintakeContext {
  runId: string;
  surface: "REGINTAKE";
  rulesetImportId: string;
  startedAtMs: number;
  manualBaselineMinutes: number;
}
export type PipelineContext = ArrContext | B1Context | B2Context | RegintakeContext;

export interface StageIO {
  runId: string;
  /** stream progress mid-stage to the live UI */
  emitProgress(pct: number, note?: string): Promise<void>;
}

export interface StageOutput {
  /** persisted on PipelineStage.output and rendered live in the UI */
  output?: unknown;
  confidence?: number;
  /** set to halt the pipeline into AWAITING_REVIEW (human-in-the-loop gate) */
  blocked?: { reason: string };
}

export interface Stage<C extends PipelineContext = PipelineContext> {
  name: string;
  label: string;
  run(ctx: C, io: StageIO): Promise<StageOutput>;
}

export interface Pipeline<C extends PipelineContext = PipelineContext> {
  surface: Surface;
  stages: Stage<C>[];
}
