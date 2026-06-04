"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, Database, Cpu } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ProvenanceData {
  fieldKey: string;
  label: string;
  value: unknown;
  classification: string;
  verified: boolean;
  totalSourceRows: number;
  sources: Array<{ entity: string; aggregation?: string; filterDescription?: string; rows: Array<Record<string, unknown>> }>;
  aiCall: { model: string; promptVersion: string; cost: string; confidence: number | null } | null;
}

function cell(v: unknown): string {
  if (v == null) return "—";
  if (v instanceof Object) return JSON.stringify(v);
  if (typeof v === "string" && /\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return String(v);
}

export function ProvenanceFigure({ reportFieldId, value, verified }: { reportFieldId: string; value: string | number; verified: boolean }) {
  const [data, setData] = useState<ProvenanceData | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (data) return;
    setLoading(true);
    const r = await fetch(`/api/report-fields/${reportFieldId}/provenance`);
    const j = await r.json();
    setLoading(false);
    if (j.ok) setData(j.data);
  }

  return (
    <Dialog onOpenChange={(o) => o && load()}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "mx-0.5 inline-flex items-center gap-1 rounded-sm border-b border-dashed px-1 font-semibold tabular-data align-baseline transition-colors",
            verified ? "border-brand-500 text-ink hover:bg-brand-50" : "border-warning text-ink hover:bg-warning-muted",
          )}
          title="Click to see the source rows"
        >
          {value}
          {verified ? <CheckCircle2 className="size-3 text-success" /> : <AlertTriangle className="size-3 text-warning" />}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {data?.label ?? "Provenance"}
            {data && (
              <span className={cn("rounded-sm px-1.5 py-0.5 text-2xs font-medium", data.verified ? "bg-success-muted text-success" : "bg-warning-muted text-warning")}>
                {data.verified ? "Verified against source" : "Unverified — review"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        {loading && <div className="py-8 text-center text-sm text-ink-muted">Loading source…</div>}
        {data && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
              <span className="rounded-sm bg-surface-sunken px-2 py-0.5">{data.classification}</span>
              <span className="tabular-data">{data.totalSourceRows} source rows</span>
              {data.aiCall && (
                <span className="inline-flex items-center gap-1">
                  <Cpu className="size-3" /> {data.aiCall.model.replace("claude-", "")} · {data.aiCall.promptVersion} · {data.aiCall.cost}
                </span>
              )}
            </div>
            {data.sources.map((src, i) => (
              <div key={i} className="rounded-md border border-border">
                <div className="flex items-center gap-2 border-b border-border bg-surface-sunken/50 px-3 py-1.5 text-2xs text-ink-muted">
                  <Database className="size-3" /> {src.entity}
                  {src.aggregation && <span>· {src.aggregation}</span>}
                  {src.filterDescription && <span>· {src.filterDescription}</span>}
                </div>
                {src.rows.length === 0 ? (
                  <div className="px-3 py-3 text-2xs text-ink-muted">No rows.</div>
                ) : (
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-2xs">
                      <thead>
                        <tr>
                          {Object.keys(src.rows[0]).filter((k) => k !== "id").map((k) => (
                            <th key={k} className="th px-3 py-1.5 normal-case tracking-normal">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {src.rows.map((row, ri) => (
                          <tr key={ri} className="text-ink">
                            {Object.keys(src.rows[0]).filter((k) => k !== "id").map((k) => (
                              <td key={k} className="px-3 py-1.5 tabular-data">{cell(row[k])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
