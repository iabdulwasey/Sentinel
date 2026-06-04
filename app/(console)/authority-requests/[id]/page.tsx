import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2, ShieldOff, FileText, ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { Panel } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { SlaCountdownChip } from "@/components/shared/sla-chip";
import { TimeSavedBanner } from "@/components/shared/time-saved";
import { ConfidenceMeter } from "@/components/shared/confidence-meter";
import { PipelineStepper } from "./_components/pipeline-stepper";
import { ProvenanceFigure } from "./_components/provenance-figure";
import { ReviewActions } from "./_components/review-actions";
import type { RequestIntent, CompliancePlan, GeneratedReport, SelfValidation, ConstraintDecision } from "@/engine/types/ai";

export const dynamic = "force-dynamic";

export default async function RequestWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const req = await db.authorityRequest.findUnique({ where: { id }, include: { market: true, reportFields: { orderBy: { ordering: "asc" } } } });
  if (!req) notFound();

  const latestRun = await db.pipelineRun.findFirst({ where: { authorityRequestId: id }, orderBy: { createdAt: "desc" } });
  const intent = req.intent as unknown as RequestIntent | null;
  const plan = req.compliancePlan as unknown as CompliancePlan | null;
  const report = req.generatedReport as unknown as GeneratedReport | null;
  const selfVal = req.selfValidation as unknown as (SelfValidation & { figureVerification?: { results: { fieldKey: string; verified: boolean }[] }; allFiguresVerified?: boolean }) | null;
  const retrieval = req.retrievalResult as unknown as { decisions?: ConstraintDecision[]; withheld?: string[] } | null;

  const canStart = req.status === "RECEIVED";
  const initialRunId = req.status === "RECEIVED" ? null : latestRun?.id ?? null;

  const fieldById = new Map(req.reportFields.map((f) => [f.fieldKey, f]));
  const figureByKey = new Map((report?.figures ?? []).map((f) => [f.fieldKey, f]));

  function renderBody(body: string): React.ReactNode[] {
    return body.split(/(\{\{\w+\}\})/g).map((p, i) => {
      const m = p.match(/^\{\{(\w+)\}\}$/);
      if (!m) return <span key={i}>{p}</span>;
      const fig = figureByKey.get(m[1]);
      const rf = fieldById.get(m[1]);
      if (fig && rf) return <ProvenanceFigure key={i} reportFieldId={rf.id} value={fig.value} verified={rf.verified} />;
      if (fig) return <strong key={i} className="tabular-data">{String(fig.value)}</strong>;
      return <span key={i}>{p}</span>;
    });
  }

  const checklistById = new Map((selfVal?.checklistResults ?? []).map((c) => [c.id, c]));
  const listFields = req.reportFields.filter((f) => Array.isArray(f.value));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* record header */}
      <div className="space-y-3">
        <Link href="/authority-requests" className="meta inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="size-3.5" /> Authority Requests
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold tracking-[-0.012em] text-ink">
              <span className="tabular-data text-ink-muted">{req.reference}</span> · {req.title}
            </h1>
            <p className="meta">{req.market.country} · {req.authority}{req.legalBasis ? ` · ${req.legalBasis}` : ""}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SlaCountdownChip deadline={req.deadlineAt} />
            <StatusBadge status={req.status} size="md" />
          </div>
        </div>
        {req.statusReason && req.status === "NEEDS_CLARIFICATION" && (
          <div className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-muted px-3 py-2.5 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span><span className="font-medium">Clarification needed:</span> {req.statusReason}</span>
          </div>
        )}
      </div>

      {req.aiElapsedMs != null && <TimeSavedBanner manualMinutes={req.manualBaselineMinutes} actualMs={req.aiElapsedMs} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* left rail */}
        <div className="space-y-6 lg:col-span-5">
          <PipelineStepper
            processUrl={`/api/authority-requests/${req.id}/process`}
            initialRunId={initialRunId}
            canStart={canStart}
            startBlurb="Run the staged AI pipeline: intake → rule mapping → retrieval → generation → self-validation."
          />

          <Panel title="Authority request" icon={FileText}>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-muted">{req.rawText}</p>
          </Panel>

          {intent && (
            <Panel title="AI interpretation" icon={ListChecks}>
              <p className="text-sm leading-relaxed text-ink">{intent.summary}</p>
              <dl className="mt-3 space-y-2 text-xs">
                <Row k="Purpose" v={intent.purpose} />
                <Row k="Subjects" v={intent.subjects.join(", ")} />
                <Row k="Zone" v={intent.filters.zone ?? "—"} />
                <Row k="Period" v={[intent.filters.periodStart, intent.filters.periodEnd].filter(Boolean).join(" → ") || "—"} />
              </dl>
              {intent.ambiguities.length > 0 && (
                <div className="mt-3 rounded-md bg-warning-muted px-3 py-2 text-[11px] leading-relaxed text-warning">
                  <span className="font-medium">Ambiguities:</span> {intent.ambiguities.join("; ")}
                </div>
              )}
            </Panel>
          )}

          {plan && (
            <Panel title={`Compliance checklist · ${plan.checklist.length} items`} icon={ListChecks}>
              <ul className="space-y-3">
                {plan.checklist.map((item) => {
                  const res = checklistById.get(item.id);
                  return (
                    <li key={item.id} className="flex items-start gap-2.5 text-xs">
                      {res?.satisfied === false ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" /> : <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />}
                      <div className="space-y-0.5">
                        <div className="font-medium text-ink">{item.requirement}</div>
                        <div className="leading-relaxed text-ink-muted">{res?.note ?? item.rationale}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 space-y-2 border-t border-border pt-3">
                <div className="eyebrow">Field disposition</div>
                {plan.fields.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-ink">{f.requestedField}</span>
                    <StatusBadge status={f.classification === "ANSWERABLE" ? "PASS" : f.classification === "OUT_OF_SCOPE" ? "FAIL" : "WARN"} label={f.classification.replace("_", " ").toLowerCase()} />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* right: report */}
        <div className="space-y-6 lg:col-span-7">
          {report ? (
            <Panel title="Generated report" icon={FileText} actions={<ReviewActions requestId={req.id} status={req.status} />}>
              <article className="rounded-md border border-border bg-surface-subtle p-6">
                <div className="flex items-center gap-2 border-b border-border pb-2.5">
                  <span className="eyebrow !tracking-[0.12em] text-brand-700">Bolt Sentinel</span>
                  <span className="meta">{req.authority}</span>
                </div>
                <h3 className="mt-3.5 text-base font-semibold text-ink">{report.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{report.preamble}</p>
                {report.sections.map((s) => (
                  <div key={s.id} className="mt-4">
                    <div className="eyebrow text-brand-700">{s.heading}</div>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink">{renderBody(s.body)}</p>
                  </div>
                ))}
                <p className="mt-4 text-xs leading-relaxed text-ink-muted">{report.closing}</p>
              </article>
              <p className="meta mt-2.5">Click any highlighted figure to trace it to its source rows.</p>
            </Panel>
          ) : (
            <Panel title="Generated report" icon={FileText}>
              <div className="py-12 text-center text-sm text-ink-muted">The report appears here once the pipeline completes.</div>
            </Panel>
          )}

          {retrieval?.decisions && retrieval.decisions.length > 0 && (
            <Panel title="Compliance constraints applied" icon={ShieldOff}>
              <ul className="space-y-2.5 text-xs">
                {retrieval.decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <StatusBadge status={d.action === "block" ? "FAIL" : d.action === "allow" ? "PASS" : "WARN"} label={d.action} />
                    <div className="space-y-0.5">
                      <span className="font-medium text-ink">{d.fieldKey}</span>
                      <span className="text-ink-muted"> — {d.rationale}</span>
                      <div className="meta">{d.rule}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {listFields.length > 0 && (
            <Panel title="Supporting detail" icon={ListChecks}>
              <ul className="space-y-2.5 text-xs">
                {listFields.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <span className="text-ink">{f.label}</span>
                    <ProvenanceFigure reportFieldId={f.id} value={`${(f.value as unknown[]).length} entries`} verified={f.verified} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {selfVal && (
            <Panel title="Self-validation" icon={CheckCircle2}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">Figures verified against source</span>
                <span className={selfVal.allFiguresVerified ? "font-medium text-success" : "font-medium text-warning"}>
                  {(selfVal.figureVerification?.results ?? []).filter((r) => r.verified).length}/{selfVal.figureVerification?.results?.length ?? 0} verified
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className="text-ink-muted">Overall confidence</span>
                <ConfidenceMeter value={selfVal.overallConfidence} />
              </div>
              {selfVal.blocking && (
                <div className="mt-2.5 rounded-md bg-warning-muted px-3 py-2 text-[11px] text-warning">Flagged for mandatory human review before submission.</div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-right text-ink">{v}</dd>
    </div>
  );
}
