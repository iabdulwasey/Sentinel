"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search, ChevronDown, ArrowLeft, Lightbulb, AlertTriangle, Info, XCircle, ArrowRight,
  BookOpen, Users, LayoutDashboard, Inbox, Truck, ShieldCheck, Scale, FileUp, Target, ScrollText, Sparkles, Settings, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentBlock, GuideSection } from "./guide-data";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "book-open": BookOpen, users: Users, "layout-dashboard": LayoutDashboard, inbox: Inbox, truck: Truck,
  "shield-check": ShieldCheck, scale: Scale, "file-up": FileUp, target: Target, "scroll-text": ScrollText,
  sparkles: Sparkles, settings: Settings, shield: Shield,
};

// ── inline **bold** · `code` · [link](/path) ─────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`([^`]+?)`)|(\[([^\]]+?)\]\(([^)]+?)\))/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={k++} className="font-semibold text-ink">{m[2]}</strong>);
    else if (m[3]) parts.push(<code key={k++} className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.8em] text-brand-700">{m[4]}</code>);
    else if (m[5]) parts.push(<Link key={k++} href={m[7]} className="font-medium text-brand-700 hover:underline">{m[6]}</Link>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

const CALLOUT = {
  tip: { border: "border-success/40", bg: "bg-success-muted", icon: Lightbulb, color: "text-success" },
  info: { border: "border-brand-400/50", bg: "bg-brand-50", icon: Info, color: "text-brand-600" },
  warning: { border: "border-warning/40", bg: "bg-warning-muted", icon: AlertTriangle, color: "text-warning" },
  danger: { border: "border-danger/40", bg: "bg-danger-muted", icon: XCircle, color: "text-danger" },
};

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p className="mb-4 text-[13.5px] leading-relaxed text-ink-muted">{renderInline(block.text)}</p>;
    case "heading": {
      const cls = block.level === 2 ? "mt-8 mb-3 text-lg font-semibold text-ink" : block.level === 3 ? "mt-6 mb-2 text-[15px] font-semibold text-ink" : "mt-5 mb-2 text-sm font-semibold text-ink";
      return <p className={cls}>{renderInline(block.text)}</p>;
    }
    case "callout": {
      const c = CALLOUT[block.variant];
      const Icon = c.icon;
      return (
        <div className={cn("mb-4 rounded-lg border-l-[3px] p-4", c.border, c.bg)}>
          <div className="flex gap-3">
            <Icon className={cn("mt-0.5 size-4 shrink-0", c.color)} strokeWidth={2} />
            <div className="min-w-0 flex-1">
              {block.title && <p className={cn("mb-1 text-[13px] font-semibold", c.color)}>{block.title}</p>}
              <p className="text-[13px] leading-relaxed text-ink/90">{renderInline(block.text)}</p>
            </div>
          </div>
        </div>
      );
    }
    case "steps":
      return (
        <div className="mb-4 space-y-2.5">
          {block.steps.map((s, i) => (
            <div key={i} className="flex gap-3.5 rounded-lg border border-border bg-surface-sunken/40 p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">{renderInline(s.title)}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{renderInline(s.description)}</p>
              </div>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="scroll-slim mb-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-surface-sunken/50">{block.headers.map((h, i) => <th key={i} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {block.rows.map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="td text-[12.5px] text-ink-muted">{renderInline(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "link-card":
      return (
        <Link href={block.href} className="panel panel-interactive group mb-4 flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink group-hover:text-brand-700">{block.title}</p>
            <p className="meta mt-0.5">{block.description}</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-ink-muted transition-all group-hover:translate-x-0.5 group-hover:text-brand-600" />
        </Link>
      );
  }
}

export function GuideView({ sections }: { sections: GuideSection[] }) {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [activeSub, setActiveSub] = useState(sections[0].subsections[0].id);
  const [search, setSearch] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .filter((s) => s.title.toLowerCase().includes(q) || s.keywords.some((k) => k.includes(q)) || s.subsections.some((sub) => sub.title.toLowerCase().includes(q)))
      .map((s) => ({ ...s, subsections: s.subsections.filter((sub) => sub.title.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || s.keywords.some((k) => k.includes(q))) }));
  }, [sections, search]);

  const navigate = useCallback((sectionId: string, subId: string) => {
    setActiveSection(sectionId);
    setActiveSub(subId);
    history.replaceState(null, "", `#${subId}`);
    scrollingRef.current = true;
    document.getElementById(subId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => { scrollingRef.current = false; }, 700);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    for (const s of sections) for (const sub of s.subsections) if (sub.id === hash) {
      setActiveSection(s.id); setActiveSub(sub.id);
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }), 80);
      return;
    }
  }, [sections]);

  // scroll-spy on the content pane
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => {
      if (scrollingRef.current) return;
      let curSec = sections[0].id, curSub = sections[0].subsections[0].id;
      for (const s of sections) for (const sub of s.subsections) {
        const node = document.getElementById(sub.id);
        if (node && node.getBoundingClientRect().top - 130 <= 0) { curSec = s.id; curSub = sub.id; }
      }
      setActiveSection(curSec);
      setActiveSub(curSub);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [sections]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-subtle">
      {/* ── Guide sidebar ─────────────────────────────────────────── */}
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <Link href="/home" title="Back to Sentinel" className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink">
            <ArrowLeft className="size-4" />
          </Link>
          <BookOpen className="size-4 text-brand-600" strokeWidth={2} />
          <span className="text-[13px] font-semibold text-ink">User Guide</span>
        </div>
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the guide…" className="h-9 w-full rounded-md border border-border bg-surface-sunken pl-8 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand-400" />
          </div>
        </div>
        <nav className="scroll-slim flex-1 space-y-0.5 overflow-y-auto p-2">
          {filtered.map((s) => {
            const Icon = ICON_MAP[s.icon] ?? BookOpen;
            const open = activeSection === s.id || search.trim().length > 0;
            const isActive = activeSection === s.id;
            return (
              <div key={s.id}>
                <button onClick={() => navigate(s.id, s.subsections[0].id)} className={cn("group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors", isActive ? "bg-brand-50 text-brand-800" : "text-ink-muted hover:bg-surface-sunken hover:text-ink")}>
                  <Icon className={cn("size-4 shrink-0", isActive ? "text-brand-700" : "text-ink-muted")} strokeWidth={2} />
                  <span className="flex-1 truncate text-[12.5px] font-medium">{s.title}</span>
                  <ChevronDown className={cn("size-3 shrink-0 text-ink-muted transition-transform", open ? "" : "-rotate-90")} />
                </button>
                {open && s.subsections.length > 0 && (
                  <div className="my-0.5 ml-3.5 space-y-0.5 border-l border-border pl-2.5">
                    {s.subsections.map((sub) => (
                      <button key={sub.id} onClick={() => navigate(s.id, sub.id)} className={cn("block w-full truncate rounded px-2 py-1 text-left text-[12px] transition-colors", activeSub === sub.id ? "font-medium text-brand-700" : "text-ink-muted hover:text-ink")}>
                        {sub.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="px-3 py-6 text-center text-[12px] text-ink-muted">No results for “{search}”.</p>}
        </nav>
      </aside>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div ref={contentRef} className="scroll-slim flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-10">
          <div className="mb-10">
            <div className="eyebrow mb-1.5">Documentation</div>
            <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">Bolt Sentinel User Guide</h1>
            <p className="mt-1.5 text-sm text-ink-muted">A complete reference for the Regulatory Operations Platform.</p>
          </div>

          {sections.map((s, si) => {
            const Icon = ICON_MAP[s.icon] ?? BookOpen;
            return (
              <section key={s.id} className="mb-14">
                <div id={s.id} className="mb-6 scroll-mt-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-[13px] font-semibold text-brand-700">{si + 1}</span>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><Icon className="size-[18px] text-ink-muted" strokeWidth={2} /> {s.title}</h2>
                  </div>
                  <p className="meta ml-11 mt-1 leading-relaxed">{s.description}</p>
                </div>
                {s.subsections.map((sub) => (
                  <div key={sub.id} id={sub.id} className="mb-8 scroll-mt-6">
                    <h3 className="mb-4 border-b border-border pb-2 text-[15px] font-semibold text-ink">{sub.title}</h3>
                    {sub.content.map((b, i) => <Block key={i} block={b} />)}
                  </div>
                ))}
              </section>
            );
          })}

          <div className="border-t border-border py-8 text-center">
            <p className="meta">Bolt Sentinel — Regulatory Operations Platform</p>
          </div>
        </div>
      </div>
    </div>
  );
}
