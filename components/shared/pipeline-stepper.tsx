"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Circle, AlertTriangle, XCircle, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDurationMs } from "@/lib/format";

interface StageView {
  name: string;
  label: string;
  status: string;
  progressPct: number;
  note?: string | null;
  durationMs?: number | null;
  startedAt?: string | null;
  confidence?: number | null;
  blockReason?: string | null;
  output?: unknown;
}
interface RunStatus {
  id: string;
  status: string;
  statusReason?: string | null;
  currentStage?: string | null;
  elapsedMs?: number | null;
  stages: StageView[];
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function PipelineStepper({
  processUrl,
  initialRunId,
  canStart,
  startLabel = "Run Sentinel pipeline",
  startBlurb = "Run the staged AI pipeline.",
}: {
  processUrl: string;
  initialRunId: string | null;
  canStart: boolean;
  startLabel?: string;
  startBlurb?: string;
}) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const drivingRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshedRef = useRef(false);

  const fetchStatus = useCallback(async (rid: string): Promise<RunStatus | null> => {
    const r = await fetch(`/api/pipelines/${rid}/status`);
    const j = await r.json();
    if (j.ok) setStatus(j.data);
    return j.ok ? (j.data as RunStatus) : null;
  }, []);

  const drive = useCallback(
    async (rid: string) => {
      if (drivingRef.current) return;
      drivingRef.current = true;
      try {
        for (let i = 0; i < 14; i++) {
          const r = await fetch(`/api/pipelines/${rid}/advance`, { method: "POST" });
          const j = await r.json();
          await fetchStatus(rid);
          if (!j.ok || !j.data?.hasMore) break;
        }
      } finally {
        drivingRef.current = false;
        if (!refreshedRef.current) {
          refreshedRef.current = true;
          router.refresh();
        }
      }
    },
    [fetchStatus, router],
  );

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      const s = await fetchStatus(runId);
      if (cancelled || !s) return;
      if (s.status === "QUEUED" || s.status === "RUNNING") {
        pollRef.current = setInterval(() => fetchStatus(runId), 700);
        void drive(runId);
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runId, fetchStatus, drive]);

  useEffect(() => {
    if (status && ["COMPLETED", "FAILED", "AWAITING_REVIEW"].includes(status.status) && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [status]);

  async function start() {
    setStarting(true);
    refreshedRef.current = false;
    const r = await fetch(processUrl, { method: "POST" });
    const j = await r.json();
    setStarting(false);
    if (j.ok) setRunId(j.data.runId);
  }

  if (!runId && canStart) {
    return (
      <div className="panel flex items-center justify-between gap-3 border-brand-200 bg-brand-50/70 p-4">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink">Ready to process</div>
          <div className="meta mt-0.5 leading-relaxed">{startBlurb}</div>
        </div>
        <Button onClick={start} disabled={starting} className="shrink-0">
          {starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {starting ? "Starting…" : startLabel}
        </Button>
      </div>
    );
  }
  if (!runId) return null;

  const stages = status?.stages ?? [];
  const doneCount = stages.filter((s) => s.status === "DONE").length;
  return (
    <div className="panel overflow-hidden">
      <div className="panel-head">
        <h2 className="panel-title">AI pipeline</h2>
        <span className="meta tabular-data">
          {doneCount}/{stages.length || "…"}
          {status?.elapsedMs != null && ` · ${formatDurationMs(status.elapsedMs)}`}
        </span>
      </div>
      <ol className="px-4 pb-3 pt-4">
        {stages.length === 0 && <li className="py-6 text-center text-sm text-ink-muted">Initializing…</li>}
        {stages.map((s, i) => (
          <StageRow key={s.name} stage={s} last={i === stages.length - 1} expanded={expanded === s.name} onToggle={() => setExpanded(expanded === s.name ? null : s.name)} />
        ))}
      </ol>
      {status?.status === "FAILED" && <div className="border-t border-border px-4 py-2 text-[11px] text-danger">Pipeline failed: {status.statusReason}</div>}
      {status?.status === "AWAITING_REVIEW" && <div className="border-t border-border px-4 py-2 text-[11px] text-warning">Paused for human review: {status.statusReason}</div>}
    </div>
  );
}

function StageRow({ stage, last, expanded, onToggle }: { stage: StageView; last: boolean; expanded: boolean; onToggle: () => void }) {
  const running = stage.status === "RUNNING";
  const now = useNow(running);
  const liveMs = running && stage.startedAt ? now - new Date(stage.startedAt).getTime() : null;
  const hasOutput = stage.output != null;

  const Icon = stage.status === "DONE" ? CheckCircle2 : running ? Loader2 : stage.status === "BLOCKED" ? AlertTriangle : stage.status === "FAILED" ? XCircle : Circle;
  const iconColor =
    stage.status === "DONE" ? "text-success" : running ? "text-brand-600" : stage.status === "BLOCKED" ? "text-warning" : stage.status === "FAILED" ? "text-danger" : "text-border-strong";
  const time = stage.status === "DONE" && stage.durationMs != null ? formatDurationMs(stage.durationMs) : running && liveMs != null ? formatDurationMs(liveMs) : "";

  return (
    <li className="flex gap-3">
      {/* rail: fixed-width column; icon + connector both centered on the same vertical axis */}
      <div className="flex w-[18px] flex-col items-center">
        <Icon className={cn("size-[18px] shrink-0 bg-card", iconColor, running && "animate-spin")} strokeWidth={2} aria-hidden />
        {!last && <span className={cn("my-1 w-px grow rounded-full", stage.status === "DONE" ? "bg-brand-500/40" : "bg-border")} />}
      </div>

      <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
        <button onClick={onToggle} className="block w-full text-left">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("flex items-center gap-1 text-[13px] font-medium", stage.status === "PENDING" ? "text-ink-muted" : "text-ink")}>
              {stage.label}
              {hasOutput && <ChevronRight className={cn("size-3 text-ink-muted transition-transform", expanded && "rotate-90")} />}
            </span>
            {time && <span className="tabular-data text-[11px] text-ink-muted">{time}</span>}
          </div>
          {running && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-brand-500 transition-all duration-200" style={{ width: `${stage.progressPct}%` }} />
            </div>
          )}
          {stage.note && <div className="mt-1 text-[11px] leading-relaxed text-ink-muted">{stage.note}</div>}
          {stage.blockReason && <div className="mt-1 text-[11px] leading-relaxed text-warning">{stage.blockReason}</div>}
          {stage.confidence != null && stage.status === "DONE" && (
            <div className="mt-0.5 tabular-data text-[11px] text-ink-muted">confidence {Math.round(stage.confidence * 100)}%</div>
          )}
        </button>
        {expanded && hasOutput && (
          <pre className="scroll-slim mt-2 max-h-56 overflow-auto rounded-md bg-surface-sunken p-3 text-[11px] leading-relaxed text-ink-muted">{JSON.stringify(stage.output, null, 2)}</pre>
        )}
      </div>
    </li>
  );
}
