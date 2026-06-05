"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Clock, Trash2, Sparkles, Globe } from "lucide-react";
import { useAssistantChat } from "@/components/assistant/use-assistant-chat";
import { ChatThread } from "@/components/assistant/chat-thread";
import { cn } from "@/lib/utils";

function Workspace() {
  const params = useSearchParams();
  const cid = params.get("c") ?? undefined;
  const chat = useAssistantChat({ conversationId: cid });

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-7xl gap-5">
      {/* previous chats */}
      <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card lg:flex">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-[13px] font-semibold text-ink">Conversations</span>
          <button onClick={chat.newChat} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[12px] font-medium text-brand-700 transition-colors hover:bg-brand-100">
            <Plus className="size-3.5" /> New
          </button>
        </div>
        <div className="scroll-slim flex-1 overflow-y-auto p-2">
          {chat.conversations.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-ink-muted">No conversations yet. Ask something to begin.</p>
          ) : (
            chat.conversations.map((c) => (
              <button key={c.id} onClick={() => chat.openConversation(c.id)} className={cn("group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors", c.id === chat.currentId ? "bg-brand-50" : "hover:bg-surface-sunken")}>
                <Clock className={cn("size-3.5 shrink-0", c.id === chat.currentId ? "text-brand-600" : "text-ink-muted")} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[12.5px]", c.id === chat.currentId ? "font-medium text-brand-800" : "text-ink")}>{c.title}</span>
                  <span className="meta tabular-data">{new Date(c.updatedAt).toLocaleDateString()}</span>
                </span>
                <span onClick={(e) => { e.stopPropagation(); chat.deleteConversation(c.id); }} className="rounded p-1 text-ink-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"><Trash2 className="size-3.5" /></span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* thread */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 sm:px-6">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600"><Sparkles className="size-4" strokeWidth={2.25} /></span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Sentinel Assistant</div>
            <div className="meta flex items-center gap-1"><Globe className="size-3" /> {chat.market ?? "All markets"} · grounded in your data, with citations</div>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <ChatThread chat={chat} variant="page" />
        </div>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}
