import type { Surface } from "../types/enums";
import type { Pipeline, PipelineContext } from "./types";

/**
 * Pipeline registry. Surface modules call registerPipeline() on import; the runner resolves
 * by surface. (Avoids a static import cycle between the runner and the surface stage modules.)
 */
const PIPELINES = new Map<Surface, Pipeline<PipelineContext>>();

export function registerPipeline(p: Pipeline<PipelineContext>): void {
  PIPELINES.set(p.surface, p);
}

export function getPipeline(surface: Surface): Pipeline<PipelineContext> {
  const p = PIPELINES.get(surface);
  if (!p) throw new Error(`No pipeline registered for surface ${surface}. Import its stage module first.`);
  return p;
}

export function isRegistered(surface: Surface): boolean {
  return PIPELINES.has(surface);
}
