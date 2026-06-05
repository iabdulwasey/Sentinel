import { Check, X, ShieldAlert, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Outcome = "approved" | "rejected" | "conditions" | "done";

const MAP: Record<Outcome, { icon: LucideIcon; label: string; tone: string; ring: string; iconColor: string }> = {
  approved: {
    icon: Check,
    label: "Approved for submission",
    tone: "text-success",
    ring: "border-success/25 bg-success-muted/60",
    iconColor: "text-success",
  },
  rejected: {
    icon: X,
    label: "Rejected — not submitted",
    tone: "text-danger",
    ring: "border-danger/25 bg-danger-muted/60",
    iconColor: "text-danger",
  },
  conditions: {
    icon: ShieldAlert,
    label: "Approved with conditions",
    tone: "text-warning",
    ring: "border-warning/25 bg-warning-muted/60",
    iconColor: "text-warning",
  },
  done: {
    icon: CheckCircle2,
    label: "Completed",
    tone: "text-ink",
    ring: "border-border bg-surface-subtle",
    iconColor: "text-ink-muted",
  },
};

/**
 * Clear, unmistakable outcome banner shown after a human decision binds.
 * Replaces the easy-to-miss "Decision recorded" line so a reviewer can see at
 * a glance what was decided, why, by whom, and when.
 */
export function DecisionOutcome({
  outcome,
  label,
  reason,
  by,
  at,
  className,
}: {
  outcome: Outcome;
  label?: string;
  reason?: string | null;
  by?: string | null;
  at?: string | null;
  className?: string;
}) {
  const cfg = MAP[outcome];
  const Icon = cfg.icon;
  const meta = [by ? `by ${by}` : null, at].filter(Boolean).join(" · ");

  return (
    <div className={cn("flex items-start gap-2.5 rounded-md border px-3.5 py-3", cfg.ring, className)}>
      <Icon className={cn("mt-px size-4 shrink-0", cfg.iconColor)} strokeWidth={2.25} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", cfg.tone)}>{label ?? cfg.label}</p>
        {reason ? <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{reason}</p> : null}
        {meta ? <p className="mt-1 text-[11px] text-ink-muted">{meta}</p> : null}
      </div>
    </div>
  );
}
