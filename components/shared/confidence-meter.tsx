import { cn } from "@/lib/utils";
import { confidenceBand, bandLabel } from "@/lib/confidence";

/** Numeric % + band label + colored bar — never color-only (band text always shown). */
export function ConfidenceMeter({
  value,
  showBar = true,
  className,
}: {
  value: number | null | undefined;
  showBar?: boolean;
  className?: string;
}) {
  if (value == null) return <span className="text-2xs text-ink-muted">—</span>;
  const band = confidenceBand(value);
  const color = band === "high" ? "bg-success" : band === "medium" ? "bg-warning" : "bg-danger";
  const text = band === "high" ? "text-success" : band === "medium" ? "text-warning" : "text-danger";
  const pct = Math.round(value * 100);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showBar && (
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
          <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
        </div>
      )}
      <span className={cn("tabular-data text-2xs font-medium", text)}>
        {pct}% · {bandLabel(band)}
      </span>
    </div>
  );
}
