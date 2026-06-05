"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, RefreshCw, Download, MessageSquareWarning, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Composer = "request_changes" | "reject";

const COMPOSER: Record<
  Composer,
  { label: React.ReactNode; placeholder: string; confirm: string; variant: "default" | "destructive"; requireNote: boolean }
> = {
  request_changes: {
    label: (
      <>
        What needs changing? This is recorded as the clarification note and the request moves to{" "}
        <span className="font-medium text-ink">Needs clarification</span>.
      </>
    ),
    placeholder: "e.g. The reporting period should be calendar Q1 2026 (1 Jan – 31 Mar), not the fiscal year.",
    confirm: "Send back for changes",
    variant: "default",
    requireNote: true,
  },
  reject: {
    label: <>Reason for rejection — recorded with the decision and shown in the audit trail.</>,
    placeholder: "e.g. Out of scope for this authority; the request must be re-issued under the correct legal basis.",
    confirm: "Confirm rejection",
    variant: "destructive",
    requireNote: false,
  },
};

const TOASTS: Record<string, string> = {
  regenerate: "Regenerating report…",
  request_changes: "Sent back for changes",
  reject: "Report rejected — not submitted",
  approve: "Approved for submission",
};

export function ReviewActions({ requestId, status }: { requestId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [note, setNote] = useState("");

  async function act(action: string, payload?: { note?: string }) {
    setBusy(action);
    const r = await fetch(`/api/authority-requests/${requestId}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({ ok: false, error: "Unexpected server response" })) : { ok: false, error: "Network error" };
    setBusy(null);
    if (!j.ok) {
      toast.error(j.error ?? "Action failed");
      return false;
    }
    toast.success(TOASTS[action] ?? "Done");
    router.refresh();
    return true;
  }

  async function confirmComposer() {
    if (!composer) return;
    const cfg = COMPOSER[composer];
    if (cfg.requireNote && !note.trim()) {
      toast.error("Add a note first");
      return;
    }
    if (await act(composer, { note: note.trim() || undefined })) {
      setComposer(null);
      setNote("");
    }
  }

  const decided = ["APPROVED", "REJECTED", "DONE"].includes(status);
  const canReview = status === "PENDING_REVIEW" || status === "NEEDS_CLARIFICATION";
  const cfg = composer ? COMPOSER[composer] : null;

  return (
    <div className="space-y-3">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setComposer((c) => (c === "request_changes" ? null : "request_changes"))}
              disabled={busy !== null}
              aria-expanded={composer === "request_changes"}
            >
              <MessageSquareWarning className="size-4" /> Request changes
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setComposer((c) => (c === "reject" ? null : "reject"))}
              disabled={busy !== null}
              aria-expanded={composer === "reject"}
            >
              <X className="size-4" /> Reject
            </Button>
            <Button size="sm" onClick={() => act("approve")} disabled={busy !== null}>
              <Check className="size-4" /> Approve for submission
            </Button>
          </>
        )}
        {decided && <span className="text-xs text-ink-muted">Export available for human submission.</span>}
      </div>

      {cfg && canReview && (
        <div className="space-y-2 rounded-md border border-border bg-surface-subtle p-3">
          <label className="meta block">{cfg.label}</label>
          <Textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            disabled={busy !== null}
            placeholder={cfg.placeholder}
            className="min-h-0 bg-surface text-sm"
          />
          <div className="flex items-center gap-2">
            <Button variant={cfg.variant} size="sm" onClick={confirmComposer} disabled={busy !== null}>
              <CornerDownLeft className="size-3.5" /> {cfg.confirm}
            </Button>
            <button
              onClick={() => {
                setComposer(null);
                setNote("");
              }}
              disabled={busy !== null}
              className="text-xs text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
