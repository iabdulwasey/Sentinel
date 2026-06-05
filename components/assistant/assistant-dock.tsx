"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Plus, Clock, Maximize2, Globe, Trash2, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { BoltMark } from "@/components/brand/logo";
import { useAssistantChat } from "./use-assistant-chat";
import { ChatThread } from "./chat-thread";

export function AssistantDock() {
  const router = useRouter();
  const chat = useAssistantChat();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const sendRef = useRef(chat.send);
  useEffect(() => { sendRef.current = chat.send; });

  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      setShowHistory(false);
      const q = (e as CustomEvent).detail?.question as string | undefined;
      if (q) setTimeout(() => sendRef.current(q), 60);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen((v) => !v); }
    };
    window.addEventListener("sentinel-assistant", onOpen as EventListener);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("sentinel-assistant", onOpen as EventListener); window.removeEventListener("keydown", onKey); };
  }, []);

  const expand = () => { setOpen(false); router.push(`/assistant?c=${chat.currentId}`); };

  if (!open) {
    return (
      <div className="fixed bottom-5 right-5 z-50 flex items-center justify-center">
        {/* expanding ring waves */}
        <span aria-hidden className="absolute size-13 rounded-full border-2 border-brand-500/40 motion-safe:animate-[chat-ring_2.5s_ease-out_infinite]" />
        <span aria-hidden className="absolute size-13 rounded-full border-2 border-brand-500/30 motion-safe:animate-[chat-ring_2.5s_ease-out_0.8s_infinite]" />
        <button onClick={() => setOpen(true)} aria-label="Open Sentinel Assistant" title="Ask Sentinel" className="group relative flex size-13 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30 transition-all duration-200 ease-out hover:scale-110 hover:shadow-xl hover:shadow-brand-500/40 active:scale-95">
          <span aria-hidden className="absolute inset-0 rounded-full bg-white opacity-0 transition-opacity duration-300 group-hover:opacity-15" />
          <BoltMark size={24} fill="#ffffff" className="relative" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[620px] max-h-[calc(100dvh-2.5rem)] w-[400px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-4">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        {showHistory ? (
          <button onClick={() => setShowHistory(false)} className="rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"><ChevronLeft className="size-4" /></button>
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-600"><Sparkles className="size-4" strokeWidth={2.25} /></span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink">{showHistory ? "Conversations" : "Sentinel Assistant"}</div>
          {!showHistory && <div className="meta flex items-center gap-1"><Globe className="size-3" /> {chat.market ?? "All markets"} · grounded</div>}
        </div>
        {!showHistory && (
          <>
            <button onClick={chat.newChat} title="New chat" className="rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"><Plus className="size-4" /></button>
            <button onClick={() => setShowHistory(true)} title="History" className="relative rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"><Clock className="size-4" />{chat.conversations.length > 0 && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-brand-500" />}</button>
            <button onClick={expand} title="Open in assistant page" className="rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"><Maximize2 className="size-4" /></button>
          </>
        )}
        <button onClick={() => setOpen(false)} title="Close" className="rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"><X className="size-4" /></button>
      </div>

      {showHistory ? (
        <div className="scroll-slim flex-1 overflow-y-auto p-2">
          {chat.conversations.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-ink-muted">No saved conversations yet.</p>
          ) : (
            chat.conversations.map((c) => (
              <button key={c.id} onClick={() => { chat.openConversation(c.id); setShowHistory(false); }} className={cn("group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors", c.id === chat.currentId ? "bg-brand-50" : "hover:bg-surface-sunken")}>
                <Clock className="size-3.5 shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-ink">{c.title}</span>
                  <span className="meta tabular-data">{new Date(c.updatedAt).toLocaleDateString()}</span>
                </span>
                <span onClick={(e) => { e.stopPropagation(); chat.deleteConversation(c.id); }} className="rounded p-1 text-ink-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"><Trash2 className="size-3.5" /></span>
              </button>
            ))
          )}
        </div>
      ) : (
        <ChatThread chat={chat} variant="dock" />
      )}
    </div>
  );
}
