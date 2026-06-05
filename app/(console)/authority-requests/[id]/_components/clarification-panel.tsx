"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CornerDownLeft, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/**
 * Subtle NEEDS_CLARIFICATION banner + the reviewer's response affordance.
 * The note is appended to the request context and the ARR pipeline re-runs,
 * so the AI can resolve the ambiguity and regenerate the report.
 */
export function ClarificationPanel({
  requestId,
  reason,
  canRespond,
}: {
  requestId: string;
  reason?: string | null;
  canRespond: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit() {
    if (!note.trim()) {
      toast.error("Add the clarification first");
      return;
    }
    setBusy(true);
    const r = await fetch(`/api/authority-requests/${requestId}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "clarify", note: note.trim() }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({ ok: false, error: "Unexpected server response" })) : { ok: false, error: "Network error" };
    setBusy(false);
    if (!j.ok) {
      toast.error(j.error ?? "Couldn't submit clarification");
      return;
    }
    toast.success("Clarification recorded — regenerating report…");
    setOpen(false);
    setNote("");
    router.refresh();
  }

  return (
    <div className="rounded-md border border-warning/20 bg-warning-muted/60 px-3 py-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-relaxed text-warning">
            <span className="font-medium">Clarification needed</span>
            {reason ? <span className="text-warning/90"> · {reason}</span> : null}
          </p>

          {canRespond && !open && (
            <button
              onClick={() => setOpen(true)}
              className="mt-1 text-[11px] font-medium text-warning underline-offset-2 hover:underline"
            >
              Provide clarification &amp; re-run →
            </button>
          )}

          {canRespond && open && (
            <div className="mt-2 space-y-2">
              <Textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                disabled={busy}
                placeholder="Specify the missing detail — e.g. the exact reporting period (calendar Q1 2026: 1 Jan – 31 Mar). This is added to the request and the pipeline re-runs."
                className="min-h-0 border-warning/25 bg-surface text-xs"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={submit} disabled={busy}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CornerDownLeft className="size-3.5" />}
                  Submit &amp; re-run
                </Button>
                <button
                  onClick={() => {
                    setOpen(false);
                    setNote("");
                  }}
                  disabled={busy}
                  className="text-[11px] text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
