import { db } from "../../lib/db";
import type { ExtractionResult } from "../types/ai";

/**
 * §7.B ground-truth eval harness. Synthetic documents are generated FROM known ground truth,
 * so extraction accuracy is measurable: we diff the live-extracted fields against the answer
 * key and compute precision/recall/F1, a per-confidence calibration curve, and defect catch-rate.
 * Powers the Accuracy view.
 */

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export interface AccuracyResult {
  sampleSize: number; // documents evaluated (extracted + ground-truth present)
  extraction: { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number };
  calibration: Array<{ bucket: string; predicted: number; accuracy: number; count: number }>;
  confidenceDistribution: Array<{ bucket: string; count: number }>;
  perMarket: Array<{ market: string; f1: number; sampleSize: number }>;
  defects: { injected: number; caughtLowConfidence: number; catchRate: number };
}

const BUCKETS: Array<[string, number, number]> = [
  ["0–50%", 0, 0.5],
  ["50–70%", 0.5, 0.7],
  ["70–85%", 0.7, 0.85],
  ["85–100%", 0.85, 1.01],
];

export async function computeAccuracy(): Promise<AccuracyResult> {
  const docs = await db.document.findMany({
    where: { deletedAt: null },
    include: { groundTruth: true, market: true },
  });
  let evaluated = 0;

  let tp = 0,
    fp = 0,
    fn = 0;
  const calib = BUCKETS.map(([label]) => ({ bucket: label, correct: 0, total: 0, sumConf: 0 }));
  const confDist = BUCKETS.map(([label]) => ({ bucket: label, count: 0 }));
  const marketAgg = new Map<string, { tp: number; fp: number; fn: number; n: number }>();
  let injected = 0,
    caught = 0;

  for (const doc of docs) {
    if (!doc.extractedFields || !doc.groundTruth) continue;
    evaluated++;
    const extraction = doc.extractedFields as unknown as ExtractionResult;
    const truth = (doc.groundTruth.fields ?? {}) as Record<string, string>;
    const defects = (doc.groundTruth.injectedDefects ?? []) as Array<{ type: string }>;
    const hasLegibilityDefect = defects.some((d) => d.type === "LOW_LEGIBILITY");
    if (defects.length) {
      injected++;
      if (hasLegibilityDefect && (doc.extractionConfidence ?? 1) < 0.7) caught++;
    }
    if (!extraction?.fields) continue;

    const m = marketAgg.get(doc.market?.code ?? "?") ?? { tp: 0, fp: 0, fn: 0, n: 0 };
    for (const f of extraction.fields) {
      const truthVal = truth[f.key];
      if (truthVal === undefined) continue; // field not part of the answer key
      const extractedPresent = f.present && f.value != null;
      const correct = extractedPresent && norm(f.value) === norm(truthVal);
      if (correct) {
        tp++;
        m.tp++;
      } else if (extractedPresent) {
        fp++;
        m.fp++;
      } else {
        fn++;
        m.fn++;
      }
      // calibration: bucket by the field's own confidence
      const conf = typeof f.confidence === "number" ? f.confidence : 0.5;
      const bi = BUCKETS.findIndex(([, lo, hi]) => conf >= lo && conf < hi);
      if (bi >= 0) {
        calib[bi].total++;
        calib[bi].sumConf += conf;
        if (correct) calib[bi].correct++;
        confDist[bi].count++;
      }
    }
    m.n++;
    marketAgg.set(doc.market?.code ?? "?", m);
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    sampleSize: evaluated,
    extraction: { precision, recall, f1, tp, fp, fn },
    calibration: calib.map((c) => ({ bucket: c.bucket, predicted: c.total ? c.sumConf / c.total : 0, accuracy: c.total ? c.correct / c.total : 0, count: c.total })),
    confidenceDistribution: confDist,
    perMarket: [...marketAgg.entries()].map(([market, a]) => {
      const p = a.tp + a.fp > 0 ? a.tp / (a.tp + a.fp) : 0;
      const r = a.tp + a.fn > 0 ? a.tp / (a.tp + a.fn) : 0;
      return { market, f1: p + r > 0 ? (2 * p * r) / (p + r) : 0, sampleSize: a.n };
    }),
    defects: { injected, caughtLowConfidence: caught, catchRate: injected ? caught / injected : 0 },
  };
}
