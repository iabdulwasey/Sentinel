import { cn } from "@/lib/utils";

/** The single page-title pattern. One H1 size everywhere; optional lead + right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ink">{title}</h1>
        {description && <p className="text-sm leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
