import Link from "next/link";
import { Truck } from "lucide-react";
import { db } from "@/lib/db";
import { resolveMarketId } from "@/lib/anchor";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";

export const dynamic = "force-dynamic";

const QUEUE = ["RECEIVED", "PROCESSING", "PENDING_REVIEW", "NEEDS_CLARIFICATION"];

export default async function FleetOnboardingPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const { market } = await searchParams;
  const marketId = await resolveMarketId(market);
  const partners = await db.fleetPartner.findMany({
    where: { deletedAt: null, status: { in: QUEUE }, ...(marketId ? { marketId } : {}) },
    include: { market: true, _count: { select: { documents: true, vehicles: true, drivers: true } } },
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Fleet Onboarding"
        description="Partners awaiting document validation, cross-checks, risk scoring, and a go/no-go decision."
      />

      {partners.length === 0 ? (
        <EmptyState icon={Truck} title="Onboarding queue is empty" description="No partners awaiting onboarding in this market." />
      ) : (
        <Panel title={`Queue · ${partners.length} awaiting`} flush>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="th">Partner</th>
                <th className="th">Market</th>
                <th className="th">Type</th>
                <th className="th">Fleet</th>
                <th className="th">Completeness</th>
                <th className="th">Risk</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {partners.map((p) => (
                <tr key={p.id} className="group transition-colors hover:bg-surface-sunken/40">
                  <td className="px-4 py-3">
                    <Link href={`/fleet-onboarding/${p.id}`} className="font-medium text-ink group-hover:text-brand-700">
                      {p.legalName}
                    </Link>
                    <div className="tabular-data text-2xs text-ink-muted">{p.reference}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{p.market.country}</td>
                  <td className="px-4 py-3 text-ink-muted">{p.partnerType.replace("_", " ").toLowerCase()}</td>
                  <td className="px-4 py-3 tabular-data text-ink-muted">{p._count.vehicles}v · {p._count.drivers}d · {p._count.documents} docs</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-sunken">
                        <div className={p.completenessPct >= 100 ? "h-full bg-success" : "h-full bg-warning"} style={{ width: `${p.completenessPct}%` }} />
                      </div>
                      <span className="tabular-data text-2xs text-ink-muted">{p.completenessPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{p.riskBand ? <StatusBadge status={p.riskBand} /> : <span className="text-2xs text-ink-muted">—</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
