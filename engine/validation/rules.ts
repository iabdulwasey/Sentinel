import { addDays } from "date-fns";
import type { ValidationRule, CrossDocumentCheck } from "../types/ruleset";
import type { ValidationOutcome, CrossCheckOutcome } from "../types/enums";

/** Tolerant date parser for extracted strings (DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD, or native). */
export function parseFlexibleDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const str = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  const m = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function normEq(a: string, b: string): boolean {
  const n = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");
  return n(a) === n(b);
}

export interface ValidationEval {
  outcome: ValidationOutcome;
  message: string;
  evidence: Record<string, unknown>;
}

export function evaluateValidation(
  rule: ValidationRule,
  fields: Record<string, string | null | undefined>,
  asOf: Date,
): ValidationEval {
  const raw = fields[rule.field];
  const present = raw != null && String(raw).trim() !== "";
  const ev = (extra: Record<string, unknown> = {}) => ({ field: rule.field, actual: raw ?? null, ...extra });
  const pass = (): ValidationEval => ({ outcome: "PASS", message: "OK", evidence: ev() });
  const fail = (msg = rule.failMessage, extra: Record<string, unknown> = {}): ValidationEval => ({ outcome: "FAIL", message: msg, evidence: ev(extra) });
  const na = (): ValidationEval => ({ outcome: "NOT_APPLICABLE", message: "Not applicable.", evidence: ev() });

  switch (rule.operator) {
    case "EXISTS":
    case "NOT_EMPTY":
      return present ? pass() : fail();
    case "MATCHES_REGEX":
      if (!present) return fail();
      try {
        return new RegExp(String(rule.value)).test(String(raw)) ? pass() : fail();
      } catch {
        return na();
      }
    case "EQUALS":
      return present && String(raw) === String(rule.value) ? pass() : fail();
    case "NOT_EQUALS":
      return String(raw) !== String(rule.value) ? pass() : fail();
    case "IN_SET":
      return Array.isArray(rule.value) && rule.value.map(String).includes(String(raw)) ? pass() : fail();
    case "DATE_NOT_EXPIRED": {
      const d = parseFlexibleDate(raw);
      if (!d) return fail("Date missing or unreadable.");
      return d >= asOf ? pass() : fail(rule.failMessage, { expiresAt: d.toISOString(), asOf: asOf.toISOString() });
    }
    case "DATE_WITHIN_DAYS": {
      const d = parseFlexibleDate(raw);
      if (!d) return na();
      const limit = addDays(asOf, Number(rule.value ?? 30));
      return d >= asOf && d <= limit ? pass() : na();
    }
    case "GTE":
      return Number(raw) >= Number(rule.value) ? pass() : fail();
    case "LTE":
      return Number(raw) <= Number(rule.value) ? pass() : fail();
    case "GT":
      return Number(raw) > Number(rule.value) ? pass() : fail();
    case "LT":
      return Number(raw) < Number(rule.value) ? pass() : fail();
    case "CROSS_FIELD_EQUALS": {
      const other = fields[rule.compareField ?? ""];
      if (!present || other == null) return fail();
      return normEq(String(raw), String(other)) ? pass() : fail(rule.failMessage, { compareField: rule.compareField, compareValue: other });
    }
    default:
      return na();
  }
}

export interface CrossCheckEval {
  outcome: CrossCheckOutcome;
  valueA: string | null;
  valueB: string | null;
  message: string;
}

export function evaluateCrossCheck(
  check: CrossDocumentCheck,
  fieldsA: Record<string, string | null | undefined>,
  fieldsB: Record<string, string | null | undefined>,
): CrossCheckEval {
  const valueA = (fieldsA[check.fieldA] ?? null) as string | null;
  const valueB = (fieldsB[check.fieldB] ?? null) as string | null;
  if (valueA == null || valueB == null || valueA === "" || valueB === "") {
    return { outcome: "INDETERMINATE", valueA, valueB, message: "One or both values were not extracted." };
  }
  if (check.operator === "MATCHES_REGEX") {
    try {
      return new RegExp(valueB).test(valueA)
        ? { outcome: "MATCH", valueA, valueB, message: "Match." }
        : { outcome: "MISMATCH", valueA, valueB, message: check.failMessage };
    } catch {
      return { outcome: "INDETERMINATE", valueA, valueB, message: "Invalid pattern." };
    }
  }
  return normEq(valueA, valueB)
    ? { outcome: "MATCH", valueA, valueB, message: "Values consistent across documents." }
    : { outcome: "MISMATCH", valueA, valueB, message: check.failMessage };
}
