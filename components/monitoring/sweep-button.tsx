"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SweepButton() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  async function sweep() {
    setBusy(true);
    const market = params.get("market") ?? undefined;
    const r = await fetch("/api/monitoring/sweep", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ market }) });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) {
      toast.error(j.error ?? "Sweep failed");
      return;
    }
    toast.success(`Swept ${j.data.swept} partners · ${j.data.expiring} expiring · ${j.data.drift} drift`);
    router.refresh();
  }

  return (
    <Button onClick={sweep} disabled={busy} size="sm">
      {busy ? <RefreshCw className="size-4 animate-spin" /> : <Radar className="size-4" />}
      {busy ? "Sweeping…" : "Run monitoring sweep"}
    </Button>
  );
}
