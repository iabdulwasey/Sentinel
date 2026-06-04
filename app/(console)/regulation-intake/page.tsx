import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { UploadForm } from "./_components/upload-form";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  RECEIVED: "bg-surface-sunken text-ink-muted",
  PROCESSING: "bg-brand-50 text-brand-700",
  PENDING_REVIEW: "bg-warning-muted text-warning",
  ACTIVATED: "bg-success-muted text-success",
  REJECTED: "bg-danger-muted text-danger",
  NEEDS_EDIT: "bg-warning-muted text-warning",
  DONE: "bg-surface-sunken text-ink-muted",
};
function ImportStatus({ s }: { s: string }) {
  return <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-medium", STATUS_TONE[s] ?? STATUS_TONE.RECEIVED)}>{s.replace(/_/g, " ").toLowerCase()}</span>;
}

export default async function RegulationIntakePage() {
  const imports = await db.rulesetImport.findMany({ where: { deletedAt: null }, orderBy: { receivedAt: "desc" }, take: 100 });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Regulation Intake"
        description="Regulations change. Upload a new statute, decree, or licensing rule and Sentinel reads it, classifies the jurisdiction, and proposes a complete machine-readable market ruleset — required documents, validations, authority-answerable fields, and data-residency policy — for a compliance officer to review and activate. The DB is the source of truth for every rule; nothing goes live without a human."
      />

      <UploadForm />

      <Panel title={`Imports · ${imports.length}`} flush>
        {imports.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-muted">No regulation imports yet — upload one above to begin.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="th">Reference</th>
                <th className="th">Source</th>
                <th className="th">Proposed market</th>
                <th className="th">Status</th>
                <th className="th text-right">Confidence</th>
                <th className="th text-right">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {imports.map((imp) => (
                <tr key={imp.id} className="row-link group">
                  <td className="td">
                    <Link href={`/regulation-intake/${imp.id}`} className="tabular-data font-medium text-ink group-hover:text-brand-700">{imp.reference}</Link>
                  </td>
                  <td className="td max-w-xs truncate text-ink-muted">{imp.fileName ?? "pasted text"}</td>
                  <td className="td">
                    {imp.targetMarketCode ? (
                      <span className="tabular-data text-ink">
                        {imp.targetMarketCode}
                        {imp.proposedVersion ? <span className="meta"> v{imp.proposedVersion}</span> : null}
                        {imp.isNewMarket ? <span className="ml-1.5 rounded-sm bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">new</span> : null}
                      </span>
                    ) : (
                      <span className="meta">—</span>
                    )}
                  </td>
                  <td className="td"><ImportStatus s={imp.status} /></td>
                  <td className="td text-right tabular-data text-ink-muted">{imp.confidence != null ? formatPercent(imp.confidence, 0) : "—"}</td>
                  <td className="td text-right tabular-data text-ink-muted">{imp.receivedAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
