import Link from "next/link";
import { addDays } from "date-fns";
import { Inbox, Truck, ShieldCheck, Clock, Sparkles, Coins, ArrowRight, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { getAsOf, resolveMarketId } from "@/lib/anchor";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { KpiStat } from "@/components/shared/kpi-stat";
import { StatusBadge } from "@/components/shared/status-badge";
import { SlaCountdownChip } from "@/components/shared/sla-chip";
import { formatCost, formatDurationMs, hoursSaved } from "@/lib/format";

export const dynamic = "force-dynamic";

const OPEN_ARR = ["RECEIVED", "PROCESSING", "PENDING_REVIEW", "NEEDS_CLARIFICATION"];
const AT_RISK = ["EXPIRING_SOON", "DRIFT_DETECTED", "PENDING_REVIEW", "SUSPENDED_RECOMMENDED"];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const { market } = await searchParams;
  const marketId = await resolveMarketId(market);
  const asOf = await getAsOf();
  const pScope = marketId ? { marketId } : {};

  const [openRequests, onboardingQueue, approvedPartners, compliant, expiringVehicles, costAgg, recentAi, doneRequests, onboardedPartners, openReqList, attention] =
    await Promise.all([
      db.authorityRequest.count({ where: { ...pScope, deletedAt: null, status: { in: OPEN_ARR } } }),
      db.fleetPartner.count({ where: { ...pScope, deletedAt: null, status: { in: ["RECEIVED", "PROCESSING", "PENDING_REVIEW"] } } }),
      db.fleetPartner.count({ where: { ...pScope, deletedAt: null, status: "APPROVED" } }),
      db.fleetPartner.count({ where: { ...pScope, deletedAt: null, status: "APPROVED", monitoringStatus: "COMPLIANT" } }),
      db.vehicle.count({ where: { partner: { ...pScope, deletedAt: null }, inspectionValidUntil: { gte: asOf, lte: addDays(asOf, 30) } } }),
      db.aiCallLog.aggregate({ _sum: { costMicroUsd: true }, _count: true }),
      db.aiCallLog.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
      db.authorityRequest.findMany({ where: { ...pScope, aiElapsedMs: { not: null } }, select: { manualBaselineMinutes: true, aiElapsedMs: true } }),
      db.fleetPartner.findMany({ where: { ...pScope, aiElapsedMs: { not: null } }, select: { manualBaselineMinutes: true, aiElapsedMs: true } }),
      db.authorityRequest.findMany({ where: { ...pScope, deletedAt: null, status: { in: OPEN_ARR } }, include: { market: true }, orderBy: { deadlineAt: "asc" }, take: 6 }),
      db.fleetPartner.findMany({ where: { ...pScope, deletedAt: null, monitoringStatus: { in: AT_RISK } }, include: { market: true }, orderBy: { riskScore: "desc" }, take: 6 }),
    ]);

  const compliantPct = approvedPartners ? Math.round((compliant / approvedPartners) * 100) : 0;
  const savedHours = [...doneRequests, ...onboardedPartners].reduce((a, x) => a + hoursSaved(x.manualBaselineMinutes, x.aiElapsedMs ?? 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Operations overview"
        description={`Regulatory operations across ${market ? "the selected market" : "all six markets"}, as of ${asOf.toISOString().slice(0, 10)}.`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiStat label="Open authority requests" value={openRequests} icon={Inbox} tone={openRequests ? "warning" : "default"} />
        <KpiStat label="Onboarding queue" value={onboardingQueue} icon={Truck} tone={onboardingQueue ? "brand" : "default"} />
        <KpiStat label="Portfolio compliant" value={`${compliantPct}%`} sublabel={`${compliant} of ${approvedPartners} partners`} icon={ShieldCheck} tone={compliantPct >= 85 ? "success" : "warning"} />
        <KpiStat label="Expiring ≤ 30 days" value={expiringVehicles} sublabel="vehicle inspections" icon={Clock} tone={expiringVehicles ? "warning" : "default"} />
        <KpiStat label="Hours saved" value={savedHours.toFixed(1)} sublabel={`${formatCost(costAgg._sum.costMicroUsd ?? 0)} AI cost · ${costAgg._count} calls`} icon={Coins} tone="brand" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Open authority requests" icon={Inbox} flush actions={<Link href="/authority-requests" className="meta inline-flex items-center gap-1 hover:text-brand-700">View all <ArrowRight className="size-3" /></Link>}>
          {openReqList.length === 0 ? (
            <Empty>No open requests.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {openReqList.map((r) => (
                <li key={r.id}>
                  <Link href={`/authority-requests/${r.id}`} className="row-link flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-ink">{r.title}</div>
                      <div className="meta tabular-data">{r.reference} · {r.market.country}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <SlaCountdownChip deadline={r.deadlineAt} />
                      <StatusBadge status={r.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Needs attention" icon={ShieldAlert} flush actions={<Link href="/compliance-monitoring" className="meta inline-flex items-center gap-1 hover:text-brand-700">Monitoring <ArrowRight className="size-3" /></Link>}>
          {attention.length === 0 ? (
            <Empty>All onboarded partners are compliant.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {attention.map((p) => (
                <li key={p.id}>
                  <Link href={`/compliance-monitoring/partners/${p.id}`} className="row-link flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-ink">{p.legalName}</div>
                      <div className="meta truncate">{p.market.country} · {p.monitoringReason ?? "—"}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.riskScore != null && <span className="tabular-data text-xs text-ink-muted">risk {p.riskScore}</span>}
                      <StatusBadge status={p.monitoringStatus} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent AI activity" icon={Sparkles} flush>
        {recentAi.length === 0 ? (
          <Empty>No AI activity yet. Open an authority request to run the pipeline.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {recentAi.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate font-medium text-ink">{c.agent}</span>
                  <span className="meta truncate">{c.stage.toLowerCase().replace(/_/g, " ")} · {c.model.replace("claude-", "")} · {c.promptVersion}</span>
                </div>
                <div className="tabular-data flex shrink-0 items-center gap-4 text-xs text-ink-muted">
                  {c.confidence != null && <span>conf {Math.round(c.confidence * 100)}%</span>}
                  <span>{formatDurationMs(c.latencyMs)}</span>
                  <span className="text-ink">{formatCost(c.costMicroUsd)}</span>
                  {!c.ok && <StatusBadge status="FAILED" />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-ink-muted">{children}</div>;
}
