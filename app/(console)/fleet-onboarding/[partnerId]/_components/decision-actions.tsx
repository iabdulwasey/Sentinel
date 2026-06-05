"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, ShieldAlert, RefreshCw, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";

type Composer = "reject" | "approve_with_conditions";

const COMPOSER: Record<
  Composer,
  { label: React.ReactNode; placeholder: string; confirm: string; variant: "default" | "destructive" | "outline"; requireNote: boolean }
> = {
  reject: {
    label: <>Reason for rejection — recorded with the decision and shown in the audit trail.</>,
    placeholder: "e.g. Insurance certificate expired and the operating licence does not cover this market.",
    confirm: "Confirm rejection",
    variant: "destructive",
    requireNote: false,
  },
  approve_with_conditions: {
    label: <>Conditions the partner must meet — recorded with the approval and carried into monitoring.</>,
    placeholder: "e.g. Submit a valid roadworthiness certificate within 14 days; re-verify insurance on renewal.",
    confirm: "Approve with conditions",
    variant: "outline",
    requireNote: true,
  },
};

const TOASTS: Record<string, string> = {
  regenerate: "Re-running onboarding…",
  reject: "Partner rejected",
  approve_with_conditions: "Approved with conditions",
  approve: "Partner approved",
};

export function DecisionActions({
  partnerId,
  status,
  hint,
  hintStatus,
  hintLabel,
}: {
  partnerId: string;
  status: string;
  hint?: string;
  hintStatus?: string;
  hintLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [note, setNote] = useState("");

  async function act(action: string, payload?: { note?: string }) {
    setBusy(action);
    const r = await fetch(`/api/partners/${partnerId}/decision`, {
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
      toast.error("Add the conditions first");
      return;
    }
    if (await act(composer, { note: note.trim() || undefined })) {
      setComposer(null);
      setNote("");
    }
  }

  const canDecide = status === "PENDING_REVIEW" || status === "NEEDS_CLARIFICATION";
  const cfg = composer ? COMPOSER[composer] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => act("regenerate")} disabled={busy !== null}>
          <RefreshCw className={busy === "regenerate" ? "size-4 animate-spin" : "size-4"} /> Re-run
        </Button>
        {canDecide && (
          <>
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
              <Check className="size-4" /> Approve
            </Button>
          </>
        )}
        {(hint || hintStatus) && (
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {hintStatus && <StatusBadge status={hintStatus} label={hintLabel} />}
            {hint && <span className="text-2xs text-ink-muted">{hint}</span>}
          </span>
        )}
      </div>
      {canDecide && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setComposer((c) => (c === "approve_with_conditions" ? null : "approve_with_conditions"))}
            disabled={busy !== null}
            aria-expanded={composer === "approve_with_conditions"}
          >
            <ShieldAlert className="size-4" /> Approve with conditions
          </Button>
        </div>
      )}

      {cfg && canDecide && (
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
