import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-3 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
        <Compass className="size-6" strokeWidth={2} />
      </span>
      <h2 className="text-lg font-semibold text-ink">Not found</h2>
      <p className="max-w-sm text-sm text-ink-muted">This record may have been removed, or the link is incorrect.</p>
      <Link href="/home"><Button variant="outline" size="sm">Back to Home</Button></Link>
    </div>
  );
}
