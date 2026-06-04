import Link from "next/link";
import { addDays } from "date-fns";
import { ShieldCheck, AlertTriangle, Clock, ShieldAlert, Bell } from "lucide-react";
import { db } from "@/lib/db";
import { getAsOf, resolveMarketId } from "@/lib/anchor";
import { PageHeader } from "@/components/shared/page-header";
import { KpiStat } from "@/components/shared/kpi-stat";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SweepButton } from "@/components/monitoring/sweep-button";

export const dynamic = "force-dynamic";

const HEALTH_ORDER = ["COMPLIANT", "EXPIRING_SOON", "DRIFT_DETECTED", "PENDING_REVIEW", "CONDITIONS_APPLIED", "SUSPENDED_RECOMMENDED", "REMEDIATED"] as const;
const HEALTH_COLOR: Record<string, string> = {
  COMPLIANT: "bg-success",
  EXPIRING_SOON: "bg-warning",
  DRIFT_DETECTED: "bg-warning",
  PENDING_REVIEW: "bg-warning",
  CONDITIONS_APPLIED: "bg-info",
  SUSPENDED_RECOMMENDED: "bg-danger",
  REMEDIATED: "bg-success",
};

export default async function ComplianceMonitoringPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const { market } = await searchParams;
  const marketId = await resolveMarketId(market);
  const asOf = await getAsOf();
  const pScope = marketId ? { marketId } : {};
  const onboarded = { ...pScope, deletedAt: null, status: { in: ["APPROVED", "CONDITIONS_APPLIED"] } };

  const partners = await db.fleetPartner.findMany({ where: onboarded, include: { market: true }, orderBy: { riskScore: "desc" } });
  const total = partners.length;
  const byStatus = HEALTH_ORDER.map((s) => ({ status: s, count: partners.filter((p) => p.monitoringStatus === s).length })).filter((x) => x.count > 0);
  const compliant = partners.filter((p) => p.monitoringStatus === "COMPLIANT").length;
  const compliantPct = total ? Math.round((compliant / total) * 100) : 0;
  const atRisk = partners.filter((p) => ["EXPIRING_SOON", "DRIFT_DETECTED", "PENDING_REVIEW", "SUSPENDED_RECOMMENDED"].includes(p.monitoringStatus));

  const expVehicles = await db.vehicle.findMany({
    where: { partner: onboarded, OR: [{ inspectionValidUntil: { gte: asOf, lte: addDays(asOf, 84) } }, { insuranceValidUntil: { gte: asOf, lte: addDays(asOf, 84) } }] },
    include: { partner: { select: { legalName: true, id: true } } },
  });
  // bucket upcoming expiries into 2-week windows over 12 weeks, by soonest validity
  const buckets = Array.from({ length: 6 }, (_, i) => ({ label: `wk ${i * 2 + 1}-${i * 2 + 2}`, count: 0 }));
  for (const v of expVehicles) {
    const soonest = [v.inspectionValidUntil, v.insuranceValidUntil].filter((d): d is Date => !!d && d >= asOf).sort((a, b) => a.getTime() - b.getTime())[0];
    if (!soonest) continue;
    const wk = Math.floor((soonest.getTime() - asOf.getTime()) / (7 * 86400000));
    const bi = Math.min(5, Math.floor(wk / 2));
    buckets[bi].count++;
  }
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  const alerts = await db.complianceEvent.findMany({
    where: { resolvedAt: null, type: { in: ["EXPIRY_FORECAST", "DRIFT_DETECTED", "RULESET_REFLAG", "ALERT"] }, ...(marketId ? { marketId } : {}) },
    include: { partner: { select: { id: true, legalName: true } } },
    orderBy: { occurredAt: "desc" },
    take: 8,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Compliance Monitoring"
        description={`Continuous monitoring of the onboarded portfolio — expiries, drift, and proactive re-triggers. As of ${asOf.toISOString().slice(0, 10)}.`}
        actions={<SweepButton />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiStat label="Portfolio compliant" value={`${compliantPct}%`} sublabel={`${compliant}/${total}`} icon={ShieldCheck} tone={compliantPct >= 85 ? "success" : "warning"} />
        <KpiStat label="At-risk partners" value={atRisk.length} icon={ShieldAlert} tone={atRisk.length ? "warning" : "default"} />
        <KpiStat label="Expiring ≤ 12 wks" value={expVehicles.length} sublabel="vehicle docs" icon={Clock} tone={expVehicles.length ? "warning" : "default"} />
        <KpiStat label="Open alerts" value={alerts.length} icon={Bell} tone={alerts.length ? "warning" : "default"} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* portfolio health */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-2">
          <h2 className="text-sm font-semibold text-ink">Portfolio health</h2>
          {total === 0 ? (
            <p className="mt-3 text-xs text-ink-muted">No onboarded partners in this market.</p>
          ) : (
            <>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-sunken">
                {byStatus.map((s) => (
                  <div key={s.status} className={HEALTH_COLOR[s.status]} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.status}: ${s.count}`} />
                ))}
              </div>
              <ul className="mt-3 space-y-1.5">
                {byStatus.map((s) => (
                  <li key={s.status} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2"><span className={`size-2 rounded-full ${HEALTH_COLOR[s.status]}`} /> <StatusBadge status={s.status} /></span>
                    <span className="tabular-data text-ink-muted">{s.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* expiry pipeline */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-2 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink">Expiry pipeline (next 12 weeks)</h2>
          <div className="mt-4 flex h-32 items-end gap-3">
            {buckets.map((b, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="tabular-data text-2xs text-ink-muted">{b.count || ""}</span>
                <div className="flex w-full items-end" style={{ height: 90 }}>
                  <div className="w-full rounded-t bg-warning/80" style={{ height: `${(b.count / maxBucket) * 100}%`, minHeight: b.count ? 4 : 0 }} />
                </div>
                <span className="text-2xs text-ink-muted">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* at-risk */}
        <div className="rounded-lg border border-border bg-card shadow-2 lg:col-span-2">
          <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold text-ink">At-risk partners</h2></div>
          {atRisk.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-muted">All onboarded partners are compliant.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="th">Partner</th>
                  <th className="th">Risk</th>
                  <th className="th">Status</th>
                  <th className="th">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {atRisk.map((p) => (
                  <tr key={p.id} className="group hover:bg-surface-sunken/40">
                    <td className="td">
                      <Link href={`/compliance-monitoring/partners/${p.id}`} className="font-medium text-ink group-hover:text-brand-700">{p.legalName}</Link>
                      <div className="meta">{p.market.country}</div>
                    </td>
                    <td className="td tabular-data">{p.riskScore ?? "—"}</td>
                    <td className="td"><StatusBadge status={p.monitoringStatus} /></td>
                    <td className="td max-w-xs truncate text-2xs text-ink-muted">{p.monitoringReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* alerts */}
        <div className="rounded-lg border border-border bg-card shadow-2">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Bell className="size-4 text-warning" /> <h2 className="text-sm font-semibold text-ink">Proactive alerts</h2></div>
          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-muted">No open alerts.</div>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((a) => (
                <li key={a.id} className="px-4 py-2.5">
                  <Link href={a.partner ? `/compliance-monitoring/partners/${a.partner.id}` : "#"} className="block">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={a.severity === "CRITICAL" || a.severity === "HIGH" ? "FAIL" : "WARN"} label={a.type.replace(/_/g, " ").toLowerCase()} />
                    </div>
                    <div className="mt-1 text-xs text-ink">{a.title}</div>
                    {a.partner && <div className="text-2xs text-ink-muted">{a.partner.legalName}</div>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
