import { addDays, addMonths, format } from "date-fns";

/**
 * All synthetic validity windows are computed relative to a single anchor (SEED_ANCHOR,
 * default 2026-06-04) so expiries/anomalies stay "live". Pin the anchor for reproducible demos.
 */
export const SEED_ANCHOR: Date = (() => {
  const raw = process.env.SEED_ANCHOR;
  const d = raw ? new Date(raw) : new Date("2026-06-04");
  return isNaN(d.getTime()) ? new Date("2026-06-04") : d;
})();

export function anchorPlusDays(n: number): Date {
  return addDays(SEED_ANCHOR, n);
}
export function anchorPlusMonths(n: number): Date {
  return addMonths(SEED_ANCHOR, n);
}

/** Map a ruleset dateFormat token (DD.MM.YYYY etc.) to a date-fns pattern. */
export function dateFnsPattern(rulesetFormat: string): string {
  return rulesetFormat
    .replace(/DD/g, "dd")
    .replace(/MM/g, "MM")
    .replace(/YYYY/g, "yyyy");
}

export function formatForMarket(date: Date, rulesetFormat: string): string {
  return format(date, dateFnsPattern(rulesetFormat));
}

/** A document issued in the past with a validity window landing in the future (normal/valid). */
export function validWindow(validityMonths: number, rng: () => number) {
  const ageMonths = 2 + Math.floor(rng() * Math.max(1, validityMonths - 4));
  const issuedAt = anchorPlusMonths(-ageMonths);
  const expiresAt = addMonths(issuedAt, validityMonths);
  return { issuedAt, expiresAt };
}

/** A document that expires exactly N days from the anchor (expiry-soon scenarios). */
export function expiringInDays(days: number, validityMonths: number) {
  const expiresAt = anchorPlusDays(days);
  const issuedAt = addMonths(expiresAt, -validityMonths);
  return { issuedAt, expiresAt };
}

/** An already-expired document. */
export function expiredWindow(daysAgo: number, validityMonths: number) {
  const expiresAt = anchorPlusDays(-daysAgo);
  const issuedAt = addMonths(expiresAt, -validityMonths);
  return { issuedAt, expiresAt };
}
