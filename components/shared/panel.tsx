import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/** The single card/section primitive. Consistent border, radius, shadow, header type, and padding. */
export function Panel({
  title,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
  interactive = false,
}: {
  title?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** flush = no body padding (for tables/lists that draw their own dividers) */
  flush?: boolean;
  interactive?: boolean;
}) {
  return (
    <section className={cn("panel overflow-hidden", interactive && "panel-interactive", className)}>
      {(title || actions) && (
        <header className="panel-head">
          {title ? (
            <h2 className="panel-title">
              {Icon && <Icon className="size-4 shrink-0 text-ink-muted" strokeWidth={2} />}
              <span className="truncate">{title}</span>
            </h2>
          ) : (
            <span />
          )}
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
