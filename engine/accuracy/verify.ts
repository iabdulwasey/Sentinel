import type { GeneratedReport, RetrievalComputedField } from "../types/ai";

/**
 * §7.B figure-vs-source verification — independent of the LLM. Every figure the model wrote
 * is re-checked against the deterministically-computed dataset: the value must match and the
 * cited source row ids must be a subset of the dataset's provenance. A mismatch or an
 * uncited/hallucinated id blocks completion.
 */
export interface FigureVerification {
  fieldKey: string;
  verified: boolean;
  reason: string;
}
export interface VerifyResult {
  results: FigureVerification[];
  allVerified: boolean;
  unverifiedKeys: string[];
}

function valuesMatch(reportValue: string | number, datasetValue: unknown): boolean {
  if (typeof datasetValue === "number" || (typeof datasetValue === "string" && /^-?\d+(\.\d+)?$/.test(datasetValue))) {
    const a = Number(reportValue);
    const b = Number(datasetValue);
    return Number.isFinite(a) && Number.isFinite(b) && a === b;
  }
  return String(reportValue).trim().toLowerCase() === String(datasetValue).trim().toLowerCase();
}

export function verifyReport(report: GeneratedReport, dataset: RetrievalComputedField[]): VerifyResult {
  const byKey = new Map(dataset.map((f) => [f.fieldKey, f]));
  const results: FigureVerification[] = [];

  for (const fig of report.figures) {
    const field = byKey.get(fig.fieldKey);
    if (!field) {
      results.push({ fieldKey: fig.fieldKey, verified: false, reason: "No matching computed figure (not in dataset / withheld)." });
      continue;
    }
    const datasetIds = new Set((field.provenance[0]?.ids ?? []) as string[]);
    const citedIds = fig.sourceRowIds ?? [];
    const idsOk = citedIds.length > 0 && citedIds.every((id) => datasetIds.has(id));
    const valueOk = valuesMatch(fig.value, field.value);

    if (!valueOk) {
      results.push({ fieldKey: fig.fieldKey, verified: false, reason: `Value ${JSON.stringify(fig.value)} does not match computed ${JSON.stringify(field.value)}.` });
    } else if (!idsOk) {
      results.push({ fieldKey: fig.fieldKey, verified: false, reason: citedIds.length === 0 ? "No source rows cited." : "Cited source rows not present in the dataset." });
    } else {
      results.push({ fieldKey: fig.fieldKey, verified: true, reason: "Value matches source; citations valid." });
    }
  }

  const unverifiedKeys = results.filter((r) => !r.verified).map((r) => r.fieldKey);
  return { results, allVerified: unverifiedKeys.length === 0, unverifiedKeys };
}
