import { TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeSaved } from "@/lib/format";

export function TimeSavedChip({ manualMinutes, actualMs, className }: { manualMinutes: number; actualMs: number; className?: string }) {
  const t = formatTimeSaved(manualMinutes, actualMs);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm bg-brand-50 px-2 py-0.5 text-2xs font-medium text-brand-700", className)}>
      <TrendingDown className="size-3" strokeWidth={2} />
      <span className="tabular-data">
        {t.manualLabel} → {t.sentinelLabel}
      </span>
    </span>
  );
}

export function TimeSavedBanner({ manualMinutes, actualMs, className }: { manualMinutes: number; actualMs: number; className?: string }) {
  const t = formatTimeSaved(manualMinutes, actualMs);
  return (
    <div className={cn("flex items-center justify-between gap-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3", className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-brand-500/15 text-brand-700">
          <TrendingDown className="size-5" strokeWidth={2} />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">
            Manual baseline {t.manualLabel} · Sentinel <span className="tabular-data">{t.sentinelLabel}</span>
          </div>
          <div className="text-xs text-ink-muted">Modeled manual effort vs. measured pipeline time. Baseline is an estimate.</div>
        </div>
      </div>
      <div className="text-right">
        <div className="tabular-data text-2xl font-semibold text-brand-700">{t.percentFaster}%</div>
        <div className="text-2xs text-ink-muted">faster</div>
      </div>
    </div>
  );
}
