"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NAV_ITEMS, UTILITY_NAV } from "@/components/app-shell/nav";

/** Global ⌘K palette: jump to any surface, or hand a question to the assistant dock. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("sentinel-cmdk", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("sentinel-cmdk", onOpen);
    };
  }, []);

  useEffect(() => { if (!open) setQ(""); }, [open]);

  const all = [...NAV_ITEMS, ...UTILITY_NAV];
  const filtered = all.filter((n) => n.label.toLowerCase().includes(q.toLowerCase()));
  const go = (href: string) => { setOpen(false); router.push(href); };
  const ask = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("sentinel-assistant", { detail: { question: q.trim() || undefined } }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="size-4 text-ink-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && q.trim() && filtered.length === 0) ask(); }}
            placeholder="Search pages, or ask Sentinel…"
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          <kbd className="rounded-sm border border-border bg-surface-sunken px-1.5 py-0.5 text-2xs text-ink-muted">esc</kbd>
        </div>
        <div className="max-h-80 overflow-auto p-2">
          {filtered.length > 0 && <div className="px-2 py-1 text-2xs uppercase tracking-wide text-ink-muted">Navigate</div>}
          {filtered.map((n) => {
            const Icon = n.icon;
            return (
              <button key={n.href} onClick={() => go(n.href)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-ink hover:bg-surface-sunken">
                <Icon className="size-4 text-ink-muted" /> {n.label}
              </button>
            );
          })}
          <div className="px-2 py-1 text-2xs uppercase tracking-wide text-ink-muted">Assistant</div>
          <button onClick={ask} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-brand-700 hover:bg-brand-50">
            <Sparkles className="size-4" /> Ask Sentinel{q.trim() ? `: “${q.trim()}”` : "…"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
