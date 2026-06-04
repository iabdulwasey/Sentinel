"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DecisionActions({ importId, blocking, isNewMarket, target, version }: { importId: string; blocking: boolean; isNewMarket: boolean; target: string; version: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"activate" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function act(kind: "activate" | "reject") {
    setError(null);
    setBusy(kind);
    try {
      const res = await fetch(`/api/regulation-intake/${importId}/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(kind === "reject" ? { note } : {}),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? `${kind} failed`);
      if (kind === "activate") {
        setResult(`Activated ${json.data.marketCode} v${json.data.version}${json.data.reflagged ? ` · ${json.data.reflagged} partner(s) re-flagged` : ""}.`);
      } else {
        setResult("Import rejected.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  if (result) {
    return <div className="panel border-brand-200 bg-brand-50/70 p-4 text-[13px] font-medium text-brand-800">{result}</div>;
  }

  return (
    <div className="panel p-4">
      <div className="text-[13px] font-semibold text-ink">
        {isNewMarket ? `Create market ${target}` : `Activate ${target} v${version}`}
      </div>
      <p className="meta mt-0.5 leading-relaxed">
        Activation writes this ruleset to the DB as the live version{isNewMarket ? " and creates the market" : `, supersedes the current version, and re-flags affected partners for re-validation`}. This is a binding human decision.
      </p>
      {blocking && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-warning-muted px-2.5 py-2 text-[11px] leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Validation flagged issues for attention. Review the proposal carefully before activating.
        </div>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Reviewer note (required to reject)…"
        className="mt-3 w-full resize-y rounded-md border border-border bg-card p-2 text-xs text-ink outline-none placeholder:text-ink-muted focus:border-brand-400"
      />
      {error && <div className="mt-2 text-[11px] text-danger">{error}</div>}
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={() => act("activate")} disabled={busy !== null}>
          {busy === "activate" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {isNewMarket ? "Create & activate" : "Activate version"}
        </Button>
        <Button variant="outline" onClick={() => act("reject")} disabled={busy !== null || !note.trim()}>
          {busy === "reject" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
          Reject
        </Button>
      </div>
    </div>
  );
}
