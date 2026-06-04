import { Target, Gauge, BarChart3, ShieldCheck, ScanSearch, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { computeAccuracy } from "@/engine/accuracy/eval";
import { PageHeader } from "@/components/shared/page-header";
import { KpiStat } from "@/components/shared/kpi-stat";
import { Panel } from "@/components/shared/panel";
import { CONFIDENCE_THRESHOLDS } from "@/lib/confidence";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PASS = CONFIDENCE_THRESHOLDS.PASS;
const REVIEW = CONFIDENCE_THRESHOLDS.REVIEW;

export default async function AccuracyPage() {
  const acc = await computeAccuracy();
  const empty = acc.sampleSize === 0;

  // Expected Calibration Error — weighted gap between predicted confidence and measured accuracy.
  const totalCalib = acc.calibration.reduce((s, c) => s + c.count, 0);
  const ece = totalCalib ? acc.calibration.reduce((s, c) => s + (c.count / totalCalib) * Math.abs(c.accuracy - c.predicted), 0) : 0;
  const maxDist = Math.max(1, ...acc.confidenceDistribution.map((d) => d.count));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Accuracy & Confidence"
        description="Every synthetic document is generated from known ground truth, so extraction is independently scorable. We diff each live extraction against the hidden answer key to measure precision, recall, calibration, and how reliably the confidence gate catches injected defects."
      />

      {/* metric row — real numbers when populated, structural placeholders when not */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiStat label="Extraction F1" value={empty ? "—" : formatPercent(acc.extraction.f1, 1)} icon={Target} tone={empty ? "default" : acc.extraction.f1 >= 0.9 ? "success" : "warning"} sublabel="harmonic precision·recall" />
        <KpiStat label="Precision" value={empty ? "—" : formatPercent(acc.extraction.precision, 1)} sublabel={empty ? "of extracted fields" : `${acc.extraction.tp} of ${acc.extraction.tp + acc.extraction.fp} correct`} />
        <KpiStat label="Recall" value={empty ? "—" : formatPercent(acc.extraction.recall, 1)} sublabel={empty ? "of expected fields" : `${acc.extraction.tp} of ${acc.extraction.tp + acc.extraction.fn} captured`} />
        <KpiStat label="Calibration error" value={empty ? "—" : formatPercent(ece, 1)} icon={Gauge} tone={empty ? "default" : ece <= 0.1 ? "success" : "warning"} sublabel="lower is better (ECE)" />
        <KpiStat label="Defect catch-rate" value={empty ? "—" : formatPercent(acc.defects.catchRate, 0)} icon={ShieldCheck} tone={empty ? "default" : "brand"} sublabel={empty ? "low-legibility defects" : `${acc.defects.caughtLowConfidence}/${acc.defects.injected} flagged for review`} />
      </div>

      {empty ? (
        <EmptyMethodology />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* calibration / reliability */}
          <Panel title="Calibration" icon={Gauge}>
            <p className="meta leading-relaxed">Do high-confidence extractions turn out right more often? Each bucket compares the model&rsquo;s predicted confidence against measured accuracy — the closer the two, the better calibrated.</p>
            <div className="mt-4 space-y-3.5">
              {acc.calibration.map((c) => {
                const gap = Math.abs(c.accuracy - c.predicted);
                return (
                  <div key={c.bucket}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-ink">{c.bucket}</span>
                      <span className="meta tabular-data">{c.count} field{c.count === 1 ? "" : "s"}{c.count > 0 && ` · Δ${formatPercent(gap, 0)}`}</span>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      <PairBar label="predicted" value={c.predicted} tone="muted" dim={c.count === 0} />
                      <PairBar label="accuracy" value={c.accuracy} tone="brand" dim={c.count === 0} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="meta mt-4 border-t border-border pt-3 tabular-data">Expected Calibration Error (ECE) {formatPercent(ece, 1)} · {totalCalib} fields across {acc.sampleSize} documents</div>
          </Panel>

          {/* confidence distribution */}
          <Panel title="Per-field confidence distribution" icon={BarChart3}>
            <p className="meta leading-relaxed">Where the engine lands its per-field confidence. Bars to the right of the {formatPercent(PASS, 0)} pass bar clear silently; the rest route to a human.</p>
            <div className="mt-6 flex h-44 items-end gap-3">
              {acc.confidenceDistribution.map((d, i) => {
                const tone = i <= 1 ? "bg-warning/70" : i === 2 ? "bg-brand-300" : "bg-brand-500";
                return (
                  <div key={d.bucket} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="tabular-data text-[11px] font-medium text-ink">{d.count || ""}</span>
                    <div className="flex w-full flex-1 items-end">
                      <div className={cn("w-full rounded-t-sm transition-all", tone)} style={{ height: `${(d.count / maxDist) * 100}%`, minHeight: d.count ? 4 : 0 }} />
                    </div>
                    <span className="meta">{d.bucket}</span>
                  </div>
                );
              })}
            </div>
            <div className="meta mt-3 flex items-center gap-3 border-t border-border pt-3">
              <LegendDot className="bg-warning/70" /> below review
              <LegendDot className="bg-brand-300" /> soft-flag
              <LegendDot className="bg-brand-500" /> auto-pass
            </div>
          </Panel>
        </div>
      )}

      {/* gating policy — always shown; this is the §7.B contract */}
      <GatingPolicy />

      {!empty && acc.perMarket.length > 0 && (
        <Panel title="Accuracy by market" icon={ScanSearch} flush>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th px-5 py-2.5 text-left">Market</th>
                <th className="th px-5 py-2.5 text-right">Extraction F1</th>
                <th className="th px-5 py-2.5 text-right">Documents</th>
              </tr>
            </thead>
            <tbody>
              {acc.perMarket.map((m) => (
                <tr key={m.market} className="border-t border-border">
                  <td className="td px-5 py-2.5 font-medium text-ink">{m.market}</td>
                  <td className="td px-5 py-2.5 text-right tabular-data">{formatPercent(m.f1, 1)}</td>
                  <td className="td px-5 py-2.5 text-right tabular-data text-ink-muted">{m.sampleSize}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

function PairBar({ label, value, tone, dim }: { label: string; value: number; tone: "brand" | "muted"; dim: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-ink-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
        <div className={cn("h-full rounded-full transition-all", tone === "brand" ? "bg-brand-500" : "bg-ink-muted/45", dim && "opacity-30")} style={{ width: `${Math.max(value * 100, dim ? 0 : 1.5)}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right tabular-data text-[11px] text-ink-muted">{formatPercent(value)}</span>
    </div>
  );
}

function LegendDot({ className }: { className: string }) {
  return <span className={cn("inline-block size-2 rounded-full", className)} />;
}

function GatingPolicy() {
  const tiers = [
    { icon: CheckCircle2, tone: "text-success", bg: "bg-success-muted", label: "Auto-pass", range: `≥ ${formatPercent(PASS, 0)}`, desc: "Accepted silently. Bars rise to 90% for financial fields and 92% for sensitive / special-category fields." },
    { icon: AlertTriangle, tone: "text-warning", bg: "bg-warning-muted", label: "Soft-flag", range: `${formatPercent(REVIEW, 0)} – ${formatPercent(PASS, 0)}`, desc: "Completes, but surfaced to a human reviewer and logged on the audit trail." },
    { icon: XCircle, tone: "text-danger", bg: "bg-danger-muted", label: "Hard block", range: `< ${formatPercent(REVIEW, 0)}`, desc: "Mandatory human-in-the-loop. Also triggered by an unverified figure or a validation mismatch — regardless of confidence." },
  ];
  return (
    <Panel title="Confidence-gating policy (§7.B)" icon={Target}>
      <p className="meta mb-4 leading-relaxed">Defined once and applied everywhere a figure is produced — the same thresholds drive the badges you see across Authority Requests and Fleet Onboarding.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {tiers.map((t) => (
          <div key={t.label} className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <span className={cn("flex size-6 items-center justify-center rounded-full", t.bg)}><t.icon className={cn("size-3.5", t.tone)} strokeWidth={2.25} /></span>
                {t.label}
              </span>
              <span className="tabular-data text-[12px] font-semibold text-ink">{t.range}</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{t.desc}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function EmptyMethodology() {
  const metrics = [
    { icon: Target, name: "Precision & recall", desc: "Field-level true / false positives and negatives, diffed against the answer key the document was generated from." },
    { icon: Gauge, name: "Calibration (ECE)", desc: "Whether predicted confidence matches measured accuracy across buckets — so a stated 90% means right ~90% of the time." },
    { icon: BarChart3, name: "Confidence distribution", desc: "How per-field confidence spreads against the pass / review / block thresholds that gate every figure." },
    { icon: ShieldCheck, name: "Defect catch-rate", desc: "Share of injected low-legibility defects the confidence gate correctly routed to a human instead of passing silently." },
  ];
  return (
    <Panel title="Awaiting evaluation data" icon={ScanSearch}>
      <p className="meta max-w-2xl leading-relaxed">
        Run a fleet-onboarding pipeline — each extracted field is scored against its document&rsquo;s hidden ground truth and the metrics below populate automatically. Nothing here is mocked; these are the dimensions that will be measured.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {metrics.map((m) => (
          <div key={m.name} className="flex gap-3 rounded-md border border-border bg-surface-sunken/40 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-50"><m.icon className="size-4 text-brand-600" strokeWidth={2} /></span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink">{m.name}</div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
