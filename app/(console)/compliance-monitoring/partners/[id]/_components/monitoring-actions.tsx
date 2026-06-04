"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, ShieldAlert, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MonitoringActions({ partnerId, monitoringStatus }: { partnerId: string; monitoringStatus: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function post(url: string, body: unknown, label: string) {
    setBusy(label);
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    setBusy(null);
    if (!j.ok) {
      toast.error(j.error ?? "Action failed");
      return;
    }
    toast.success("Done");
    router.refresh();
  }

  const atRisk = ["EXPIRING_SOON", "DRIFT_DETECTED", "PENDING_REVIEW"].includes(monitoringStatus);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => post(`/api/partners/${partnerId}/monitoring/revalidate`, {}, "reval")} disabled={busy !== null}>
        <RefreshCw className={busy === "reval" ? "size-4 animate-spin" : "size-4"} /> Re-validate
      </Button>
      {atRisk && (
        <>
          <Button variant="outline" size="sm" onClick={() => post(`/api/partners/${partnerId}/monitoring/decision`, { action: "remediate" }, "rem")} disabled={busy !== null}>
            <CheckCircle2 className="size-4" /> Mark remediated
          </Button>
          <Button variant="outline" size="sm" onClick={() => post(`/api/partners/${partnerId}/monitoring/decision`, { action: "apply_conditions" }, "cond")} disabled={busy !== null}>
            <ShieldAlert className="size-4" /> Apply conditions
          </Button>
          <Button variant="destructive" size="sm" onClick={() => post(`/api/partners/${partnerId}/monitoring/decision`, { action: "recommend_suspend" }, "susp")} disabled={busy !== null}>
            <Ban className="size-4" /> Recommend suspension
          </Button>
        </>
      )}
    </div>
  );
}
