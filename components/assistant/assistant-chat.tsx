"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowUp, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Citation {
  claim: string;
  sourceLabel: string;
  href: string | null;
  entity: string | null;
  entityId: string | null;
}
interface Msg {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  grounded?: boolean;
}

const SUGGESTIONS = [
  "What authority requests are open and when are they due?",
  "Which partners are at risk, and why?",
  "What vehicle documents expire in the next 30 days?",
  "Summarize the open request from the Estonian authority.",
];

export function AssistantChat({ onNavigate, initialQuestion }: { onNavigate?: () => void; initialQuestion?: string }) {
  const params = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const askedInitial = useRef(false);

  useEffect(() => {
    if (initialQuestion && initialQuestion.trim() && !askedInitial.current) {
      askedInitial.current = true;
      void ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  async function ask(q?: string) {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, market: params.get("market") ?? undefined }) });
      const j = await r.json();
      if (!j.ok) setMessages((m) => [...m, { role: "assistant", text: j.error ?? "Something went wrong.", grounded: false }]);
      else setMessages((m) => [...m, { role: "assistant", text: j.data.answer, citations: j.data.citations, grounded: j.data.grounded }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "The assistant is unavailable.", grounded: false }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-auto p-1">
        {messages.length === 0 && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm text-ink-muted"><Sparkles className="size-4 text-brand-600" /> Ask about requests, partners, expiries, or risk across your markets.</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-md border border-border bg-card px-3 py-2 text-left text-xs text-ink-muted transition-colors hover:border-brand-300 hover:text-ink">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.role === "user" ? "bg-brand-500 text-[#06281A]" : "border border-border bg-card text-ink")}>
              {m.role === "assistant" && m.grounded === false && (
                <div className="mb-1 flex items-center gap-1 text-2xs text-warning"><AlertTriangle className="size-3" /> No grounded source found</div>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
                  {m.citations.map((c, ci) =>
                    c.href ? (
                      <Link key={ci} href={c.href} onClick={onNavigate} className="inline-flex items-center gap-1 rounded-sm bg-brand-50 px-1.5 py-0.5 text-2xs text-brand-700 hover:bg-brand-100" title={c.claim}>
                        <ExternalLink className="size-2.5" /> {c.sourceLabel}
                      </Link>
                    ) : (
                      <span key={ci} className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-2xs text-ink-muted" title={c.claim}>{c.sourceLabel}</span>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-ink-muted"><Loader2 className="size-3.5 animate-spin text-brand-600" /> Sentinel is checking the records…</div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
        className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Sentinel…"
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        <button type="submit" disabled={loading || !input.trim()} className="flex size-7 items-center justify-center rounded-md bg-brand-500 text-[#06281A] disabled:opacity-40">
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
