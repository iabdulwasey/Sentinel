import type { MarketRuleset } from "../types/ruleset";

/**
 * Deterministic "executor dry-run". The retrieval executor (engine/retrieval/executor.ts) can only
 * compute authority-field sources that fit a fixed capability surface — so before a proposed ruleset
 * is offered for activation, we statically verify every ANSWERABLE field's source is actually
 * executable. Anything that isn't is surfaced for the human to fix; it is never silently broken.
 *
 * Keep this in lockstep with executor.ts.
 */

export interface SourceIssue {
  ref: string; // authority-field key
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
}

const EXEC: Record<string, { aggs: Set<string>; fields: Set<string>; sumFields?: Set<string>; namedFilters: boolean }> = {
  Driver: {
    aggs: new Set(["count", "list"]),
    fields: new Set(["licenseExpiresAt", "permitExpiresAt", "status", "nationalId", "licenseNo", "permitNo", "fullName"]),
    namedFilters: true,
  },
  Vehicle: {
    aggs: new Set(["count", "list"]),
    fields: new Set(["registrationValidUntil", "insuranceValidUntil", "inspectionValidUntil", "status", "addedAt", "plate", "year", "make", "model", "vin", "registrationNo"]),
    namedFilters: true,
  },
  Trip: {
    aggs: new Set(["count", "sum"]),
    fields: new Set(["zone", "city", "startedAt", "fareMinor", "distanceKm"]),
    sumFields: new Set(["fareMinor", "distanceKm"]),
    namedFilters: false, // Trip is scoped by request zone/period, not namedFilters
  },
  FleetPartner: {
    aggs: new Set(["count", "list"]),
    fields: new Set(["partnerType", "status", "riskBand", "riskScore", "reference", "legalName", "tradingName", "registrationNo"]),
    namedFilters: true,
  },
};

const FILTER_OPS = new Set(["EQUALS", "NOT_EQUALS", "DATE_NOT_EXPIRED", "DATE_WITHIN_DAYS", "GTE", "LTE", "NOT_EMPTY", "EXISTS"]);

export function validateRulesetSources(rs: MarketRuleset): { ok: boolean; issues: SourceIssue[] } {
  const issues: SourceIssue[] = [];
  for (const f of rs.authorityFields) {
    if (f.classification === "OUT_OF_SCOPE") continue; // not executed
    if (!f.source) {
      if (f.classification === "ANSWERABLE") {
        issues.push({ ref: f.key, severity: "MEDIUM", message: "ANSWERABLE field has no source — the executor cannot compute it." });
      }
      continue;
    }
    const cap = EXEC[f.source.entity];
    if (!cap) {
      issues.push({ ref: f.key, severity: "HIGH", message: `Source entity "${f.source.entity}" is not executable (only Driver / Vehicle / Trip / FleetPartner).` });
      continue;
    }
    if (!cap.aggs.has(f.source.aggregation)) {
      issues.push({ ref: f.key, severity: "HIGH", message: `Aggregation "${f.source.aggregation}" is not supported for ${f.source.entity} (use ${[...cap.aggs].join(" / ")}).` });
    }
    if (f.source.aggregation === "sum") {
      if (!f.source.field) {
        issues.push({ ref: f.key, severity: "HIGH", message: "sum requires a numeric `field`." });
      } else if (cap.sumFields && !cap.sumFields.has(f.source.field)) {
        issues.push({ ref: f.key, severity: "MEDIUM", message: `sum field "${f.source.field}" is not a known numeric column (try ${[...cap.sumFields].join(" / ")}).` });
      }
    }
    for (const rid of f.source.filterRuleIds ?? []) {
      const nf = rs.namedFilters?.[rid];
      if (!nf) {
        issues.push({ ref: f.key, severity: "HIGH", message: `filterRuleId "${rid}" has no matching namedFilter.` });
        continue;
      }
      if (!FILTER_OPS.has(nf.operator)) {
        issues.push({ ref: f.key, severity: "MEDIUM", message: `namedFilter "${rid}" uses operator ${nf.operator}, which the executor does not apply as a filter.` });
      }
      if (!cap.fields.has(nf.field)) {
        issues.push({ ref: f.key, severity: "LOW", message: `namedFilter "${rid}" field "${nf.field}" may not exist on ${f.source.entity}.` });
      }
    }
    if (f.source.entity === "Trip" && (f.source.filterRuleIds?.length ?? 0) > 0) {
      issues.push({ ref: f.key, severity: "LOW", message: "Trip sources are scoped by request zone/period; filterRuleIds are ignored." });
    }
  }
  return { ok: issues.filter((i) => i.severity === "HIGH").length === 0, issues };
}
