"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, RefreshCw, Download, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReviewActions({ requestId, status }: { requestId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: string) {
    setBusy(action);
    const r = await fetch(`/api/authority-requests/${requestId}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await r.json();
    setBusy(null);
    if (!j.ok) {
      toast.error(j.error ?? "Action failed");
      return;
    }
    toast.success(action === "regenerate" ? "Regenerating report…" : `Request ${action.replace("_", " ")}`);
    router.refresh();
  }

  const decided = ["APPROVED", "REJECTED", "DONE"].includes(status);
  const canReview = status === "PENDING_REVIEW" || status === "NEEDS_CLARIFICATION";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`/api/authority-requests/${requestId}/export?format=pdf`} target="_blank" rel="noreferrer">
        <Button variant="outline" size="sm">
          <Download className="size-4" /> Export PDF
        </Button>
      </a>
      <a href={`/api/authority-requests/${requestId}/export?format=json`} target="_blank" rel="noreferrer">
        <Button variant="outline" size="sm">
          <Download className="size-4" /> JSON
        </Button>
      </a>
      <Button variant="outline" size="sm" onClick={() => act("regenerate")} disabled={busy !== null}>
        <RefreshCw className={busy === "regenerate" ? "size-4 animate-spin" : "size-4"} /> Regenerate
      </Button>
      {canReview && (
        <>
          <Button variant="outline" size="sm" onClick={() => act("request_changes")} disabled={busy !== null}>
            <MessageSquareWarning className="size-4" /> Request changes
          </Button>
          <Button variant="destructive" size="sm" onClick={() => act("reject")} disabled={busy !== null}>
            <X className="size-4" /> Reject
          </Button>
          <Button size="sm" onClick={() => act("approve")} disabled={busy !== null}>
            <Check className="size-4" /> Approve for submission
          </Button>
        </>
      )}
      {decided && <span className="text-xs text-ink-muted">Decision recorded — export available for human submission.</span>}
    </div>
  );
}
