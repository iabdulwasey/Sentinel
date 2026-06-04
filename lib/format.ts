/** Shared formatters so time-saved / cost / durations read identically across every surface. */

/** Cost ledger stores micro-USD (Int) to avoid float drift. */
export function formatCost(microUsd: number): string {
  const usd = microUsd / 1_000_000;
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

/** Compact human duration from milliseconds: "420ms", "1.2s", "38s", "2m 04s", "1h 05m". */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(totalSec < 10 ? 1 : 0)}s`;
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  if (m < 60) return `${m}m ${String(s).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

/** Human minutes → "~45m" / "~4h 10m" (used for the manual-effort baseline). */
export function formatMinutes(min: number): string {
  if (min < 60) return `~${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `~${h}h` : `~${h}h ${String(m).padStart(2, "0")}m`;
}

export interface TimeSaved {
  manualLabel: string;
  sentinelLabel: string;
  percentFaster: number;
  /** e.g. "Manual ~4h 10m · Sentinel 38s · 98% faster" */
  contrast: string;
}

/** The before/after value device. `manualMinutes` is a labelled estimate; `actualMs` is measured. */
export function formatTimeSaved(manualMinutes: number, actualMs: number): TimeSaved {
  const manualLabel = formatMinutes(manualMinutes);
  const sentinelLabel = formatDurationMs(actualMs);
  const manualMs = manualMinutes * 60_000;
  const percentFaster =
    manualMs > 0 ? Math.max(0, Math.round((1 - actualMs / manualMs) * 100)) : 0;
  return {
    manualLabel,
    sentinelLabel,
    percentFaster,
    contrast: `Manual ${manualLabel} · Sentinel ${sentinelLabel} · ${percentFaster}% faster`,
  };
}

/** Hours saved (for cumulative dashboard KPI). */
export function hoursSaved(manualMinutes: number, actualMs: number): number {
  return Math.max(0, manualMinutes / 60 - actualMs / 3_600_000);
}

export function formatPercent(value0to1: number, digits = 0): string {
  return `${(value0to1 * 100).toFixed(digits)}%`;
}
