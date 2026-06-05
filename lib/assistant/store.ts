/** Shared assistant conversation store — localStorage, used by both the dock and the /assistant page. */

export interface Citation { claim: string; sourceLabel: string; href?: string | null; entity?: string | null; entityId?: string | null }
export interface ChartSpec { type: "bar" | "line" | "donut"; title: string; unit?: string | null; data: { name: string; value: number }[] }
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  grounded?: boolean;
  suggestions?: string[];
  chart?: ChartSpec | null;
  streaming?: boolean;
}
export interface Conversation { id: string; title: string; updatedAt: number; messages: ChatMessage[] }

export const ASSISTANT_KEY = "sentinel.assistant.convos.v1";

export const STARTER_QUESTIONS = [
  "Which partners have documents expiring in the next 30 days?",
  "What authority requests are awaiting review?",
  "Show partners flagged for compliance drift.",
  "Break down portfolio health by market.",
];

export function newConversationId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ASSISTANT_KEY);
    const list = raw ? (JSON.parse(raw) as Conversation[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveConversations(list: Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ASSISTANT_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* storage full / unavailable */
  }
}

export function conversationTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New conversation";
  return first.text.length > 52 ? first.text.slice(0, 52) + "…" : first.text;
}
