"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  type ChatMessage, type Conversation, type ChartSpec, type Citation,
  loadConversations, saveConversations, conversationTitle, newConversationId,
} from "@/lib/assistant/store";

interface Meta { citations?: Citation[]; suggestions?: string[]; chart?: ChartSpec | null; grounded?: boolean }

/** Split the stream into the markdown prose + the `===DATA===` JSON. The data line comes FIRST
 *  (so the chart is ready as the answer streams); falls back to trailing-data or pure prose. */
function splitStream(full: string): { prose: string; meta: Meta | null } {
  const t = full.replace(/^\s+/, "");
  if (t.startsWith("===DATA===")) {
    const nl = t.indexOf("\n");
    if (nl === -1) return { prose: "", meta: null }; // still receiving the data line
    let meta: Meta | null = null;
    try { meta = JSON.parse(t.slice(10, nl).trim()) as Meta; } catch { meta = null; }
    return { prose: t.slice(nl + 1), meta };
  }
  const idx = t.indexOf("===DATA===");
  if (idx >= 0) {
    let meta: Meta | null = null;
    try { meta = JSON.parse(t.slice(idx + 10).trim()) as Meta; } catch { meta = null; }
    return { prose: t.slice(0, idx), meta };
  }
  return { prose: t, meta: null };
}

/** The shared brain for the assistant — streaming send + localStorage-backed conversations. */
export function useAssistantChat(options?: { conversationId?: string }) {
  const params = useSearchParams();
  const market = params.get("market") ?? undefined;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string>(options?.conversationId ?? newConversationId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const hydrated = useRef(false);
  const skipPersist = useRef(false); // true right after loading an existing convo, so a mere open doesn't re-sort it

  // hydrate: load history; open a requested conversation if present
  useEffect(() => {
    const list = loadConversations();
    setConversations(list);
    if (options?.conversationId) {
      const found = list.find((c) => c.id === options.conversationId);
      if (found) { skipPersist.current = true; setCurrentId(found.id); setMessages(found.messages); }
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.conversationId]);

  // persist the active conversation
  useEffect(() => {
    if (!hydrated.current || messages.length === 0) return;
    if (skipPersist.current) { skipPersist.current = false; return; } // just opened an existing convo — don't re-sort
    setConversations((prev) => {
      const entry: Conversation = { id: currentId, title: conversationTitle(messages), updatedAt: Date.now(), messages };
      const next = [entry, ...prev.filter((c) => c.id !== currentId)];
      saveConversations(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const patchLastAssistant = (patch: Partial<ChatMessage>) =>
    setMessages((m) => {
      const i = m.length - 1;
      if (i < 0 || m[i].role !== "assistant") return m;
      const next = [...m];
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || loading) return;
      const history = messages.map((m) => ({ role: m.role, text: m.text }));
      setMessages((m) => [...m, { role: "user", text }, { role: "assistant", text: "", streaming: true }]);
      setLoading(true);
      try {
        const res = await fetch("/api/assistant/stream", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, market, history }) });
        if (!res.ok || !res.body) throw new Error("stream failed");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          const { prose, meta } = splitStream(full);
          patchLastAssistant({ text: prose, streaming: true, chart: meta?.chart ?? null });
        }
        const { prose, meta } = splitStream(full);
        patchLastAssistant({ text: prose.trim() || full.trim(), streaming: false, citations: meta?.citations, suggestions: meta?.suggestions, chart: meta?.chart ?? null, grounded: meta?.grounded });
      } catch {
        patchLastAssistant({ text: "The assistant is unavailable right now. Please try again.", streaming: false, grounded: false });
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, market],
  );

  const newChat = useCallback(() => {
    setCurrentId(newConversationId());
    setMessages([]);
  }, []);

  const openConversation = useCallback((id: string) => {
    const found = loadConversations().find((c) => c.id === id);
    if (found) { skipPersist.current = true; setCurrentId(found.id); setMessages(found.messages); }
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        saveConversations(next);
        return next;
      });
      if (id === currentId) newChat();
    },
    [currentId, newChat],
  );

  return { conversations, currentId, messages, loading, market, send, newChat, openConversation, deleteConversation };
}
export type AssistantChat = ReturnType<typeof useAssistantChat>;
