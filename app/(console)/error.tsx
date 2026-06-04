"use client";

import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-3 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-muted text-danger">
        <AlertOctagon className="size-6" strokeWidth={2} />
      </span>
      <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
      <p className="max-w-sm text-sm text-ink-muted">{error.message || "An unexpected error occurred while loading this view."}</p>
      <Button onClick={reset} variant="outline" size="sm">Try again</Button>
    </div>
  );
}
