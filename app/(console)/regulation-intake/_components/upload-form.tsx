"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setError(null);
    if (!file && !text.trim()) {
      setError("Attach a regulation file or paste its text.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      if (text.trim()) form.append("rawText", text.trim());
      const res = await fetch("/api/regulation-intake/process", { method: "POST", body: form });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Upload failed");
      router.push(`/regulation-intake/${json.data.importId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2">
        <UploadCloud className="size-4 text-ink-muted" />
        <h2 className="panel-title">Import a regulation</h2>
      </div>
      <p className="meta mt-1 leading-relaxed">
        Upload a regulation (PDF or image) or paste its text. Sentinel reads it, classifies the jurisdiction, and proposes a complete market ruleset for your review — it activates nothing on its own.
      </p>

      {/* dropzone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
        className={cn(
          "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
          dragOver ? "border-brand-400 bg-brand-50/60" : "border-border hover:border-brand-300 hover:bg-surface-sunken/40",
        )}
      >
        <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <span className="inline-flex items-center gap-2 text-sm text-ink">
            <FileText className="size-4 text-brand-600" /> {file.name}
            <button type="button" onClick={(e) => { e.preventDefault(); setFile(null); if (inputRef.current) inputRef.current.value = ""; }} className="text-ink-muted hover:text-danger"><X className="size-3.5" /></button>
          </span>
        ) : (
          <>
            <UploadCloud className="size-6 text-ink-muted" />
            <span className="text-sm text-ink">Drop a PDF here, or click to choose</span>
            <span className="meta">PDF, PNG, or JPEG</span>
          </>
        )}
      </label>

      <div className="mt-4">
        <div className="eyebrow mb-1.5">Or paste regulation text</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Paste the regulation's text…"
          className="scroll-slim w-full resize-y rounded-md border border-border bg-card p-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand-400"
        />
      </div>

      {error && <div className="mt-3 text-[11px] text-danger">{error}</div>}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          {busy ? "Starting…" : "Import & analyze"}
        </Button>
      </div>
    </div>
  );
}
