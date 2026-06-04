"use client";

import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export default function AssistantPage() {
  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
      <div className="mb-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink">
          <Sparkles className="size-5 text-brand-600" /> Assistant
        </h1>
        <p className="text-sm text-ink-muted">Grounded answers across authority requests, onboarding, and monitoring — with citations to the underlying records.</p>
      </div>
      <div className="min-h-0 flex-1">
        <Suspense>
          <AssistantChat />
        </Suspense>
      </div>
    </div>
  );
}
