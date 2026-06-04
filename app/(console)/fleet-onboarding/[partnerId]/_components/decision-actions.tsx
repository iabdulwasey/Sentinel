"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DecisionActions({ partnerId, status }: { partnerId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: string) {
    setBusy(action);
    const r = await fetch(`/api/partners/${partnerId}/decision`, {
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
    toast.success(action === "regenerate" ? "Re-running onboarding…" : `Decision: ${action.replace(/_/g, " ")}`);
    router.refresh();
  }

  const decided = ["APPROVED", "CONDITIONS_APPLIED", "REJECTED"].includes(status);
  const canDecide = status === "PENDING_REVIEW" || status === "NEEDS_CLARIFICATION";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => act("regenerate")} disabled={busy !== null}>
        <RefreshCw className={busy === "regenerate" ? "size-4 animate-spin" : "size-4"} /> Re-run
      </Button>
      {canDecide && (
        <>
          <Button variant="destructive" size="sm" onClick={() => act("reject")} disabled={busy !== null}>
            <X className="size-4" /> Reject
          </Button>
          <Button variant="outline" size="sm" onClick={() => act("approve_with_conditions")} disabled={busy !== null}>
            <ShieldAlert className="size-4" /> Approve with conditions
          </Button>
          <Button size="sm" onClick={() => act("approve")} disabled={busy !== null}>
            <Check className="size-4" /> Approve
          </Button>
        </>
      )}
      {decided && <span className="text-xs text-ink-muted">Decision recorded — partner moves into compliance monitoring.</span>}
    </div>
  );
}
