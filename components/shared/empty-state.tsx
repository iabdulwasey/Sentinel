import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/50 px-6 py-14 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="text-sm font-medium text-ink">{title}</div>
      {description && <div className="max-w-sm text-xs text-ink-muted">{description}</div>}
      {action}
    </div>
  );
}
