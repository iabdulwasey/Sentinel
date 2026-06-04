"use client";

import { useState } from "react";
import { FileText, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfidenceMeter } from "@/components/shared/confidence-meter";

interface ExtractedField {
  key: string;
  label: string;
  value?: string | null;
  present: boolean;
  confidence: number;
  note?: string | null;
}
export interface DocView {
  id: string;
  docType: string;
  title: string;
  status: string;
  url: string;
  extractionConfidence: number | null;
  fields: ExtractedField[];
  gaps: string[];
}

export function DocumentViewer({ documents }: { documents: DocView[] }) {
  const [selectedId, setSelectedId] = useState(documents[0]?.id ?? null);
  const selected = documents.find((d) => d.id === selectedId) ?? documents[0] ?? null;

  if (documents.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-ink-muted">No documents uploaded.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
      {/* doc list */}
      <ul className="space-y-1">
        {documents.map((d) => (
          <li key={d.id}>
            <button
              onClick={() => setSelectedId(d.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                d.id === selected?.id ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-surface-sunken",
              )}
            >
              <FileText className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{d.title}</span>
              {d.status === "FLAGGED" && <AlertTriangle className="size-3 shrink-0 text-warning" />}
              {d.status === "VALIDATED" && <CheckCircle2 className="size-3 shrink-0 text-success" />}
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* PDF */}
          <div className="overflow-hidden rounded-md border border-border bg-surface-sunken">
            <iframe src={selected.url} title={selected.title} className="h-[460px] w-full bg-white" />
          </div>
          {/* extracted fields */}
          <div className="rounded-md border border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-medium text-ink">Extracted fields</span>
              <ConfidenceMeter value={selected.extractionConfidence} />
            </div>
            <div className="max-h-[420px] overflow-auto">
              {selected.fields.length === 0 ? (
                <div className="px-3 py-6 text-center text-2xs text-ink-muted">Not yet extracted — run the pipeline.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {selected.fields.map((f) => {
                    const low = f.present && f.confidence < 0.7;
                    const missing = !f.present;
                    return (
                      <li key={f.key} className={cn("px-3 py-2", low && "bg-warning-muted/50", missing && "bg-danger-muted/40")}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-2xs uppercase tracking-wide text-ink-muted">{f.label}</span>
                          <ConfidenceMeter value={f.present ? f.confidence : 0} showBar={false} />
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {missing ? <XCircle className="size-3 text-danger" /> : low ? <AlertTriangle className="size-3 text-warning" /> : <CheckCircle2 className="size-3 text-success" />}
                          <span className={cn("text-sm tabular-data", missing ? "text-danger" : "text-ink")}>{f.value ?? "not found"}</span>
                        </div>
                        {f.note && <div className="mt-0.5 text-2xs text-ink-muted">{f.note}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {selected.gaps.length > 0 && (
              <div className="border-t border-border bg-warning-muted px-3 py-2 text-2xs text-warning">
                Gaps: {selected.gaps.join("; ")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
