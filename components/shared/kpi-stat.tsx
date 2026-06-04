import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function KpiStat({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "brand";
  className?: string;
}) {
  const toneText =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "brand" ? "text-brand-700" : "text-ink";
  return (
    <div className={cn("panel p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {Icon && <Icon className="size-4 text-ink-muted/70" strokeWidth={2} />}
      </div>
      <div className={cn("tabular-data mt-2.5 text-[26px] font-semibold leading-none", toneText)}>{value}</div>
      {sublabel && <div className="meta mt-1.5">{sublabel}</div>}
    </div>
  );
}
