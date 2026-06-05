import Link from "next/link";
import { Inbox } from "lucide-react";
import { db } from "@/lib/db";
import { resolveMarketId } from "@/lib/anchor";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { SlaCountdownChip } from "@/components/shared/sla-chip";
import { EmptyState } from "@/components/shared/empty-state";

export const dynamic = "force-dynamic";

const OPEN = ["RECEIVED", "PROCESSING", "PENDING_REVIEW", "NEEDS_CLARIFICATION"];

export default async function AuthorityRequestsPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const { market } = await searchParams;
  const marketId = await resolveMarketId(market);
  const requests = await db.authorityRequest.findMany({
    where: { deletedAt: null, ...(marketId ? { marketId } : {}) },
    include: { market: true },
    orderBy: [{ receivedAt: "desc" }],
  });
  const sorted = [...requests].sort((a, b) => Number(OPEN.includes(b.status)) - Number(OPEN.includes(a.status)));
  const openCount = requests.filter((r) => OPEN.includes(r.status)).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Authority Requests"
        description="Incoming regulator requests — interpreted, populated, and turned into compliant reports for human review."
      />

      {sorted.length === 0 ? (
        <EmptyState icon={Inbox} title="No authority requests" description="No requests in this market yet." />
      ) : (
        <Panel title={`Requests · ${openCount} open`} flush>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="th w-44">Reference</th>
                <th className="th">Request</th>
                <th className="th w-40">Market</th>
                <th className="th w-44">Status</th>
                <th className="th w-36">Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((r) => (
                <tr key={r.id} className="row-link group">
                  <td className="td whitespace-nowrap">
                    <Link href={`/authority-requests/${r.id}`} className="tabular-data font-medium text-ink group-hover:text-brand-700">
                      {r.reference}
                    </Link>
                  </td>
                  <td className="td">
                    <Link href={`/authority-requests/${r.id}`} className="block max-w-md truncate text-ink group-hover:text-brand-700">
                      {r.title}
                    </Link>
                    <span className="meta">{r.authority}</span>
                  </td>
                  <td className="td text-ink-muted">{r.market.country}</td>
                  <td className="td"><StatusBadge status={r.status} /></td>
                  <td className="td"><SlaCountdownChip deadline={r.deadlineAt} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
