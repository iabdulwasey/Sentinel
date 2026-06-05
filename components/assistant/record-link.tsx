"use client";

import { useState } from "react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Field { label: string; value: string; tone?: "success" | "warning" | "danger" }
interface Preview { kind: string; title: string; subtitle?: string; href: string; fields: Field[] }

const cache = new Map<string, Preview>();

/** An inline chat link that previews the record in a popover first, with an "Open" drill-down. */
export function RecordLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(() => cache.get(href) ?? null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function load() {
    if (preview || loading) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/assistant/preview?href=${encodeURIComponent(href)}`);
      const j = await r.json();
      if (j.ok) { cache.set(href, j.data); setPreview(j.data); } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer font-medium text-brand-700 underline decoration-brand-300 decoration-from-font underline-offset-2 transition-colors hover:decoration-brand-500 hover:text-brand-800">
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={6} className="w-72 overflow-hidden p-0">
        {preview ? (
          <>
            <div className="border-b border-border px-3 py-2">
              <div className="eyebrow">{preview.kind}</div>
              <div className="mt-0.5 text-[13px] font-semibold leading-snug text-ink">{preview.title}</div>
              {preview.subtitle && <div className="meta">{preview.subtitle}</div>}
            </div>
            <div className="space-y-1.5 px-3 py-2.5">
              {preview.fields.map((f, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-[12px]">
                  <span className="shrink-0 text-ink-muted">{f.label}</span>
                  <span className={cn("min-w-0 text-right", f.tone === "success" ? "font-medium text-success" : f.tone === "warning" ? "font-medium text-warning" : f.tone === "danger" ? "font-medium text-danger" : "text-ink")}>{f.value}</span>
                </div>
              ))}
            </div>
            <Link href={preview.href} className="flex items-center justify-center gap-1 border-t border-border bg-surface-sunken/40 px-3 py-2 text-[12px] font-medium text-brand-700 transition-colors hover:bg-brand-50">
              Open full page <ArrowUpRight className="size-3.5" />
            </Link>
          </>
        ) : loading ? (
          <div className="flex items-center gap-2 p-3 text-[12px] text-ink-muted"><Loader2 className="size-3.5 animate-spin" /> Loading preview…</div>
        ) : (
          <div className="p-3 text-[12px] text-ink-muted">
            {failed ? "Preview unavailable. " : ""}
            <Link href={href} className="font-medium text-brand-700 hover:underline">Open full page →</Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
