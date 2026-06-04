import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ListChecks, ShieldAlert, GitCompare, ScanSearch, Quote, AlertTriangle, CheckCircle2, Globe2 } from "lucide-react";
import { db } from "@/lib/db";
import { Panel } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { PipelineStepper } from "@/components/shared/pipeline-stepper";
import { DecisionActions } from "../_components/decision-actions";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RegulationClassification, RegulationReading, RulesetSynthesisOutput, RulesetValidation } from "@/engine/types/ai";
import type { MarketRuleset } from "@/engine/types/ruleset";

export const dynamic = "force-dynamic";

const SEV: Record<string, string> = {
  INFO: "bg-surface-sunken text-ink-muted",
  LOW: "bg-surface-sunken text-ink-muted",
  MEDIUM: "bg-warning-muted text-warning",
  HIGH: "bg-danger-muted text-danger",
  CRITICAL: "bg-danger-muted text-danger",
};
function Sev({ s }: { s: string }) {
  return <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", SEV[s] ?? SEV.INFO)}>{s}</span>;
}
function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "brand" | "warning" | "danger" }) {
  const c = tone === "brand" ? "bg-brand-50 text-brand-700" : tone === "warning" ? "bg-warning-muted text-warning" : tone === "danger" ? "bg-danger-muted text-danger" : "bg-surface-sunken text-ink-muted";
  return <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-medium", c)}>{children}</span>;
}

export default async function RegulationIntakeWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const imp = await db.rulesetImport.findUnique({ where: { id } });
  if (!imp) notFound();

  const run = await db.pipelineRun.findFirst({ where: { rulesetImportId: id }, orderBy: { createdAt: "desc" } });
  const cls = imp.classification as unknown as RegulationClassification | null;
  const reading = imp.reading as unknown as RegulationReading | null;
  const wrapper = imp.draftRuleset as unknown as RulesetSynthesisOutput | null;
  const rs: MarketRuleset | null = wrapper?.ruleset ?? null;
  const val = imp.validation as unknown as (RulesetValidation & { schemaValid?: boolean; sourceCheck?: { ok: boolean; issues: { ref: string; severity: string; message: string }[] }; blocking?: boolean }) | null;
  const diff = imp.diff as unknown as { isNewMarket?: boolean; summary?: string; documents?: { added: string[]; removed: string[]; changed: string[] }; authorityFields?: { added: string[]; removed: string[]; changed: string[] }; policyChanges?: string[] } | null;

  const decided = imp.status === "ACTIVATED" || imp.status === "REJECTED";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* header */}
      <div className="space-y-3">
        <Link href="/regulation-intake" className="meta inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="size-3.5" /> Regulation Intake
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-xl font-semibold tracking-[-0.012em] text-ink">{reading?.title ?? imp.fileName ?? imp.reference}</h1>
            <p className="meta tabular-data">{imp.reference} · {imp.fileName ?? "pasted text"}{reading?.sourceLanguage ? ` · lang ${reading.sourceLanguage}` : ""}</p>
            {cls && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Chip tone="brand">{cls.country}</Chip>
                <Chip>{cls.region}</Chip>
                <Chip tone={cls.privacyRegime === "GDPR" ? "brand" : "warning"}>{cls.privacyRegime}</Chip>
                <Chip>{imp.targetMarketCode}{imp.proposedVersion ? ` v${imp.proposedVersion}` : ""}</Chip>
                {imp.isNewMarket ? <Chip tone="brand">new market</Chip> : <Chip tone="warning">version update</Chip>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {imp.confidence != null && <span className="meta tabular-data">proposal confidence {formatPercent(imp.confidence, 0)}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <PipelineStepper processUrl={`/api/regulation-intake/process`} initialRunId={run?.id ?? null} canStart={false} />

          {/* proposed ruleset */}
          {rs && wrapper && (
            <>
              <Panel title={`Proposed required documents · ${rs.requiredDocuments.length}`} icon={FileText} flush>
                <ul className="divide-y divide-border">
                  {rs.requiredDocuments.map((d) => (
                    <li key={d.docType} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink">{d.label}</div>
                          <div className="meta tabular-data">{d.docType} · {d.expectedFields.length} fields · {d.validations.length} rules{d.validityMonths ? ` · ${d.validityMonths}mo` : ""}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">{d.requiredFor.map((r) => <Chip key={r}>{r.toLowerCase()}</Chip>)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title={`Authority-answerable fields · ${rs.authorityFields.length}`} icon={ListChecks} flush>
                <ul className="divide-y divide-border">
                  {rs.authorityFields.map((f) => (
                    <li key={f.key} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink">{f.label}</div>
                          <div className="meta tabular-data">{f.key} · {f.dataClass}{f.source ? ` · ${f.source.aggregation}(${f.source.entity})` : ""}</div>
                          {f.cautionNote && <div className="mt-1 text-[11px] leading-relaxed text-warning">{f.cautionNote}</div>}
                        </div>
                        <StatusBadge status={f.classification === "ANSWERABLE" ? "PASS" : f.classification === "OUT_OF_SCOPE" ? "FAIL" : "WARN"} label={f.classification.replace("_", " ").toLowerCase()} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Proposed compliance policy" icon={ShieldAlert}>
                <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                  <div>
                    <div className="eyebrow mb-1.5">Data residency</div>
                    <div className="flex items-center gap-1.5 text-ink">
                      <Globe2 className="size-3.5 text-ink-muted" />
                      {rs.compliancePolicy.dataResidency.crossBorderTransferAllowed ? "Cross-border transfer permitted" : "Residency restricted"}
                    </div>
                    <p className="meta mt-1 leading-relaxed">{rs.compliancePolicy.dataResidency.note}</p>
                  </div>
                  <div>
                    <div className="eyebrow mb-1.5">Retention & bases</div>
                    <div className="meta tabular-data">Docs {rs.compliancePolicy.retention.documentRetentionMonths}mo · audit {rs.compliancePolicy.retention.auditLogRetentionMonths}mo</div>
                    <div className="meta mt-0.5">{rs.compliancePolicy.lawfulBases.length} lawful bases · {rs.compliancePolicy.purposeLimitation.restrictedDisclosureFieldKeys.length} restricted-disclosure fields</div>
                  </div>
                </div>
              </Panel>

              {/* honest gaps */}
              {(wrapper.unmappedFields.length > 0 || wrapper.unsupportedClauses.length > 0) && (
                <Panel title="Flagged for human wiring" icon={AlertTriangle}>
                  {wrapper.unmappedFields.length > 0 && (
                    <div className="mb-3">
                      <div className="eyebrow mb-1.5">Unmapped answerable fields (left OUT_OF_SCOPE)</div>
                      <ul className="space-y-1 text-xs">{wrapper.unmappedFields.map((u, i) => <li key={i} className="text-ink-muted"><span className="font-medium text-ink">{u.label}</span> — {u.reason}</li>)}</ul>
                    </div>
                  )}
                  {wrapper.unsupportedClauses.length > 0 && (
                    <div>
                      <div className="eyebrow mb-1.5">Clauses not expressible in the rule DSL (manual checks)</div>
                      <ul className="space-y-1 text-xs">{wrapper.unsupportedClauses.map((u, i) => <li key={i} className="text-ink-muted"><span className="font-medium text-ink">{u.clause}</span> — {u.reason}</li>)}</ul>
                    </div>
                  )}
                </Panel>
              )}

              {/* provenance */}
              {wrapper.provenance.length > 0 && (
                <Panel title={`Provenance · ${wrapper.provenance.length}`} icon={Quote} flush>
                  <ul className="divide-y divide-border">
                    {wrapper.provenance.slice(0, 40).map((p, i) => (
                      <li key={i} className="px-5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="tabular-data text-[11px] font-medium text-ink">{p.ref}</span>
                          <span className="meta tabular-data">{formatPercent(p.confidence, 0)}{p.sectionId ? ` · ${p.sectionId}` : ""}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">“{p.sourceQuote}”</p>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </>
          )}
        </div>

        {/* right rail: decision + validation + diff + classification */}
        <div className="space-y-6 lg:col-span-4">
          {imp.status === "PENDING_REVIEW" || imp.status === "NEEDS_EDIT" ? (
            <DecisionActions importId={imp.id} blocking={!!val?.blocking} isNewMarket={imp.isNewMarket} target={imp.targetMarketCode ?? rs?.marketCode ?? "?"} version={imp.proposedVersion ?? 1} />
          ) : imp.status === "ACTIVATED" ? (
            <div className="panel border-brand-200 bg-brand-50/70 p-4">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-800"><CheckCircle2 className="size-4" /> Activated</div>
              <p className="meta mt-1">{imp.targetMarketCode} v{imp.proposedVersion} is now the live ruleset.</p>
              {imp.targetMarketCode && <Link href={`/rules/${imp.targetMarketCode}`} className="mt-2 inline-block text-xs font-medium text-brand-700 hover:underline">View in Markets &amp; Rules →</Link>}
            </div>
          ) : imp.status === "REJECTED" ? (
            <div className="panel border-danger/30 bg-danger-muted/50 p-4">
              <div className="text-[13px] font-semibold text-danger">Rejected</div>
              {imp.reviewNote && <p className="meta mt-1">{imp.reviewNote}</p>}
            </div>
          ) : (
            <div className="panel p-4 text-[13px] text-ink-muted">Analysis in progress…</div>
          )}

          {/* validation */}
          {val && (
            <Panel title="Validation" icon={ScanSearch}>
              <div className="flex flex-wrap gap-1.5">
                <Chip tone={val.schemaValid ? "brand" : "danger"}>{val.schemaValid ? "schema valid" : "schema invalid"}</Chip>
                <Chip tone={val.sourceCheck?.ok ? "brand" : "warning"}>{val.sourceCheck?.ok ? "sources executable" : "source issues"}</Chip>
                <Chip tone={val.blocking ? "warning" : "brand"}>{val.blocking ? "needs attention" : "clean"}</Chip>
                {val.overallConfidence != null && <Chip>confidence {formatPercent(val.overallConfidence, 0)}</Chip>}
              </div>
              {(val.issues?.length ?? 0) > 0 && (
                <ul className="mt-3 space-y-1.5 text-xs">
                  {val.issues.map((it, i) => (
                    <li key={i} className="flex items-start justify-between gap-2">
                      <span className="text-ink-muted">{it.ref ? <span className="tabular-data text-ink">{it.ref}: </span> : null}{it.message}</span>
                      <Sev s={it.severity} />
                    </li>
                  ))}
                </ul>
              )}
              {(val.sourceCheck?.issues?.length ?? 0) > 0 && (
                <div className="mt-3 border-t border-border pt-2.5">
                  <div className="eyebrow mb-1.5">Executor dry-run</div>
                  <ul className="space-y-1.5 text-xs">
                    {val.sourceCheck!.issues.map((it, i) => (
                      <li key={i} className="flex items-start justify-between gap-2"><span className="text-ink-muted"><span className="tabular-data text-ink">{it.ref}: </span>{it.message}</span><Sev s={it.severity} /></li>
                    ))}
                  </ul>
                </div>
              )}
              {(val.completenessNotes?.length ?? 0) > 0 && (
                <div className="mt-3 border-t border-border pt-2.5">
                  <div className="eyebrow mb-1.5">Completeness</div>
                  <ul className="list-inside list-disc space-y-1 text-[11px] text-ink-muted">{val.completenessNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                </div>
              )}
            </Panel>
          )}

          {/* diff (updates) */}
          {diff && !diff.isNewMarket && (
            <Panel title="Changes vs current version" icon={GitCompare}>
              <p className="text-xs text-ink">{diff.summary}</p>
              {diff.documents && (diff.documents.added.length + diff.documents.removed.length + diff.documents.changed.length > 0) && (
                <div className="mt-2 meta tabular-data">documents: {diff.documents.added.map((x) => `+${x}`).concat(diff.documents.removed.map((x) => `−${x}`), diff.documents.changed.map((x) => `~${x}`)).join(", ")}</div>
              )}
              {(diff.policyChanges?.length ?? 0) > 0 && <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-ink-muted">{diff.policyChanges!.map((c, i) => <li key={i}>{c}</li>)}</ul>}
            </Panel>
          )}

          {/* classification rationale */}
          {cls && (
            <Panel title="Classification" icon={ScanSearch}>
              <p className="text-xs leading-relaxed text-ink-muted">{cls.rationale}</p>
              <div className="meta mt-2 tabular-data">{cls.regulatorName} ({cls.regulatorCode}) · {cls.currency} · {cls.locale} · {cls.timezone}</div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
