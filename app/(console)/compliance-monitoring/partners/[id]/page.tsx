import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, CalendarClock, ShieldAlert, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getAsOf } from "@/lib/anchor";
import { StatusBadge } from "@/components/shared/status-badge";
import { MonitoringActions } from "./_components/monitoring-actions";
import type { RiskFactor } from "@/engine/types/ai";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function PartnerMonitoringDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const partner = await db.fleetPartner.findUnique({
    where: { id },
    include: {
      market: true,
      vehicles: { orderBy: { addedAt: "asc" } },
      documents: { orderBy: { expiresAt: "asc" } },
      history: { orderBy: { occurredAt: "desc" }, take: 20 },
      events: { orderBy: { occurredAt: "desc" }, take: 20 },
      riskAssessments: { where: { isCurrent: true }, take: 1 },
    },
  });
  if (!partner) notFound();
  const asOf = await getAsOf();
  const risk = partner.riskAssessments[0];
  const factors = (risk?.factors as unknown as RiskFactor[]) ?? [];

  // merge history + events into one timeline
  const timeline = [
    ...partner.history.map((h) => ({ at: h.occurredAt, kind: h.kind, title: h.kind.replace(/_/g, " "), source: "history" as const })),
    ...partner.events.map((e) => ({ at: e.occurredAt, kind: e.type, title: e.title, source: "event" as const })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  function validity(d: Date | null) {
    if (!d) return { tone: "FAIL", label: "missing" };
    if (d < asOf) return { tone: "FAIL", label: "expired" };
    if (d <= new Date(asOf.getTime() + 30 * 86400000)) return { tone: "WARN", label: "expiring" };
    return { tone: "PASS", label: "valid" };
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <Link href="/compliance-monitoring" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
          <ArrowLeft className="size-3.5" /> Compliance Monitoring
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{partner.legalName}</h1>
            <p className="text-sm text-ink-muted">{partner.market.country} · {partner.reference} · onboarded {fmtDate(partner.onboardedAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            {partner.riskBand && <StatusBadge status={partner.riskBand} />}
            <StatusBadge status={partner.monitoringStatus} size="md" />
          </div>
        </div>
        {partner.monitoringReason && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-muted px-3 py-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {partner.monitoringReason}
          </div>
        )}
        <div className="mt-3"><MonitoringActions partnerId={partner.id} monitoringStatus={partner.monitoringStatus} /></div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* document & vehicle timeline */}
        <div className="rounded-lg border border-border bg-card shadow-2">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3"><CalendarClock className="size-4 text-ink-muted" /> <h2 className="text-sm font-semibold text-ink">Document & vehicle validity</h2></div>
          <div className="max-h-[420px] overflow-auto p-2">
            <table className="w-full text-xs">
              <thead><tr><th className="th px-2 py-1.5">Vehicle</th><th className="th px-2 py-1.5">Inspection</th><th className="th px-2 py-1.5">Insurance</th><th className="th px-2 py-1.5">Registration</th></tr></thead>
              <tbody className="divide-y divide-border">
                {partner.vehicles.map((v) => {
                  const cells = [v.inspectionValidUntil, v.insuranceValidUntil, v.registrationValidUntil];
                  return (
                    <tr key={v.id}>
                      <td className="px-2 py-1.5 font-medium tabular-data text-ink">{v.plate}</td>
                      {cells.map((c, i) => {
                        const val = validity(c);
                        return (
                          <td key={i} className="px-2 py-1.5">
                            <span className={val.tone === "FAIL" ? "text-danger" : val.tone === "WARN" ? "text-warning" : "text-ink-muted"}>{fmtDate(c)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* compliance history */}
        <div className="rounded-lg border border-border bg-card shadow-2">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3"><History className="size-4 text-ink-muted" /> <h2 className="text-sm font-semibold text-ink">Compliance history</h2></div>
          <ol className="max-h-[420px] space-y-3 overflow-auto p-4">
            {timeline.length === 0 && <li className="text-sm text-ink-muted">No history yet.</li>}
            {timeline.map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-500" />
                <div>
                  <div className="text-xs font-medium text-ink">{t.title}</div>
                  <div className="text-2xs text-ink-muted tabular-data">{fmtDate(t.at)} · {t.source}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {risk && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-2">
          <div className="flex items-center gap-2"><ShieldAlert className="size-4 text-ink-muted" /> <h2 className="text-sm font-semibold text-ink">Current risk · {risk.score}/{risk.band}</h2></div>
          <p className="mt-1 text-xs text-ink-muted">{risk.explanation}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {factors.map((f, i) => (
              <div key={i} className="text-2xs">
                <div className="flex justify-between"><span className="text-ink">{f.label}</span><span className="tabular-data text-ink-muted">+{f.contribution}</span></div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-surface-sunken"><div className="h-full bg-warning" style={{ width: `${Math.min(100, f.contribution)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
