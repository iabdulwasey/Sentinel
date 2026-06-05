"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Send, ExternalLink, AlertTriangle, Loader2, ArrowUpRight } from "lucide-react";
import { STARTER_QUESTIONS, type ChatMessage } from "@/lib/assistant/store";
import { MessageMarkdown } from "./message-markdown";
import { ChatChart } from "./chat-chart";
import type { AssistantChat } from "./use-assistant-chat";
import { cn } from "@/lib/utils";

export function ChatThread({ chat, variant = "dock" }: { chat: AssistantChat; variant?: "dock" | "page" }) {
  const { messages, loading, send } = chat;
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const wide = variant === "page";

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const lastA = [...messages].reverse().find((m) => m.role === "assistant" && !m.streaming);
  const followups = !loading && lastA?.suggestions?.length ? lastA.suggestions : [];

  const submit = () => { const v = input; setInput(""); send(v); };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className={cn("scroll-slim flex-1 overflow-y-auto", wide ? "px-4 py-6 sm:px-6" : "p-3")}>
        <div className={cn("space-y-4", wide && "mx-auto max-w-3xl")}>
          {messages.length === 0 ? <Empty onPick={(q) => send(q)} wide={wide} /> : messages.map((m, i) => <Bubble key={i} m={m} />)}
        </div>
      </div>

      {followups.length > 0 && (
        <div className={cn("scroll-slim overflow-x-auto border-t border-border", wide ? "px-4 py-2.5 sm:px-6" : "px-3 py-2")}>
          <div className={cn("flex gap-1.5", wide && "mx-auto max-w-3xl")}>
            {followups.map((s) => (
              <button key={s} onClick={() => send(s)} className="shrink-0 whitespace-nowrap rounded-full border border-border bg-surface px-2.5 py-1 text-[11.5px] text-ink-muted transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">{s}</button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className={cn("border-t border-border", wide ? "px-4 py-3 sm:px-6" : "p-2.5")}>
        <div className={cn(wide && "mx-auto max-w-3xl")}>
          <div className="flex items-end gap-2 rounded-lg border border-border bg-surface-sunken px-2.5 py-1.5 focus-within:border-brand-400 focus-within:ring-3 focus-within:ring-brand-500/15">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1}
              placeholder="Ask Sentinel…"
              className="scroll-slim max-h-32 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[13px] text-ink outline-none placeholder:text-ink-muted"
            />
            <button type="submit" disabled={!input.trim() || loading} className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-500 text-[#04130c] transition-opacity disabled:opacity-40">
              <Send className="size-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Empty({ onPick, wide }: { onPick: (q: string) => void; wide: boolean }) {
  return (
    <div className={cn(wide ? "mx-auto max-w-2xl pt-10" : "px-1 py-3")}>
      <div className="flex size-10 items-center justify-center rounded-xl bg-brand-500/12 text-brand-600"><Sparkles className="size-5" strokeWidth={2} /></div>
      <p className="mt-3 text-[15px] font-semibold text-ink">How can I help?</p>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-ink-muted">Ask about authority requests, partner onboarding, upcoming expiries, drift, or any market. Every answer is grounded in your data — with citations and charts.</p>
      <div className="eyebrow mb-1.5 mt-4">Suggested</div>
      <div className={cn("gap-1.5", wide ? "grid sm:grid-cols-2" : "flex flex-col")}>
        {STARTER_QUESTIONS.map((s) => (
          <button key={s} onClick={() => onPick(s)} className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-[12.5px] transition-colors hover:border-brand-300 hover:bg-brand-50">
            <span className="min-w-0 text-ink-muted group-hover:text-brand-700">{s}</span>
            <ArrowUpRight className="size-3.5 shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-50 px-3.5 py-2 text-[13px] leading-relaxed text-ink">{m.text}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-600"><Sparkles className="size-3.5" strokeWidth={2.25} /></span>
      <div className="min-w-0 flex-1">
        {m.grounded === false && !m.streaming && (
          <div className="mb-1 flex items-center gap-1 text-[11px] text-warning"><AlertTriangle className="size-3" /> No grounded source found</div>
        )}
        {m.text ? (
          <MessageMarkdown text={m.streaming ? m.text + " ▍" : m.text} />
        ) : m.streaming ? (
          <div className="flex items-center gap-2 text-[13px] text-ink-muted"><Loader2 className="size-3.5 animate-spin text-brand-600" /> Thinking…</div>
        ) : null}
        {m.chart && !m.streaming && <ChatChart spec={m.chart} />}
        {/* Sources are linked inline in the prose; only show a footer for any extra citations the model returned separately. */}
        {m.citations && m.citations.length > 0 && !m.streaming && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-ink-muted">Sources</span>
            {m.citations.map((c, ci) =>
              c.href ? (
                <Link key={ci} href={c.href} title={c.claim} className="inline-flex items-center gap-1 rounded-sm bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 hover:underline">
                  <ExternalLink className="size-2.5" /> {c.sourceLabel}
                </Link>
              ) : (
                <span key={ci} title={c.claim} className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[11px] text-ink-muted">{c.sourceLabel}</span>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
