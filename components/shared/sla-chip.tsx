"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(ms: number): string {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Live SLA countdown to a deadline. Tone shifts neutral → amber (≤24h) → red (overdue). */
export function SlaCountdownChip({ deadline, className }: { deadline: string | Date | null; className?: string }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return null;
  const target = new Date(deadline).getTime();
  const remaining = target - now;
  const overdue = remaining < 0;
  const soon = !overdue && remaining < 24 * 3_600_000;
  const tone = overdue ? "bg-danger-muted text-danger" : soon ? "bg-warning-muted text-warning" : "bg-surface-sunken text-ink-muted";
  const Icon = overdue ? AlertTriangle : Clock;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-2xs font-medium", tone, className)} aria-label={overdue ? "SLA overdue" : "SLA remaining"}>
      <Icon className="size-3" strokeWidth={2} />
      <span className="tabular-data">{overdue ? `Overdue ${fmt(remaining)}` : `${fmt(remaining)} left`}</span>
    </span>
  );
}
