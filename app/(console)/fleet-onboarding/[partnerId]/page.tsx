import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ListChecks, ShieldAlert, Gavel, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { resolveRuleset } from "@/engine/rules/store";
import { storage } from "@/engine/storage";
import { Panel } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfidenceMeter } from "@/components/shared/confidence-meter";
import { TimeSavedBanner } from "@/components/shared/time-saved";
import { PipelineStepper } from "@/components/shared/pipeline-stepper";
import { DocumentViewer, type DocView } from "./_components/document-viewer";
import { DecisionActions } from "./_components/decision-actions";
import { DecisionOutcome } from "@/components/shared/decision-outcome";
import type { ExtractionResult, OnboardingDecision, RiskFactor } from "@/engine/types/ai";
import type { PartnerType } from "@/engine/types/enums";

export const dynamic = "force-dynamic";

export default async function OnboardingWorkspace({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await params;
  const partner = await db.fleetPartner.findUnique({
    where: { id: partnerId },
    include: {
      market: true,
      documents: { where: { deletedAt: null }, orderBy: { docType: "asc" } },
      validations: { orderBy: { createdAt: "asc" } },
      crossChecks: { orderBy: { createdAt: "asc" } },
      riskAssessments: { where: { isCurrent: true }, take: 1 },
    },
  });
  if (!partner) notFound();

  const ruleset = await resolveRuleset(partner.market.code, partner.market.activeRulesetVersion);
  const store = storage();
  const required = ruleset.requiredDocuments.filter((d) => !d.optional && d.requiredFor.includes(partner.partnerType as PartnerType));
  const presentTypes = new Set(partner.documents.map((d) => d.docType));
  const latestRun = await db.pipelineRun.findFirst({ where: { partnerId, surface: "B1" }, orderBy: { createdAt: "desc" } });

  const docViews: DocView[] = partner.documents.map((d) => {
    const er = d.extractedFields as unknown as ExtractionResult | null;
    return {
      id: d.id,
      docType: d.docType,
      title: d.title,
      status: d.status,
      url: store.getUrl(d.storageRef),
      extractionConfidence: d.extractionConfidence,
      fields: er?.fields ?? [],
      gaps: er?.gaps ?? [],
    };
  });

  const decision = partner.decision as unknown as (OnboardingDecision & { draft?: boolean; humanNote?: string; decidedAt?: string; decidedBy?: string }) | null;
  const risk = partner.riskAssessments[0];
  const factors = (risk?.factors as unknown as RiskFactor[]) ?? [];
  const canStart = partner.status === "RECEIVED";
  const initialRunId = partner.status === "RECEIVED" ? null : latestRun?.id ?? null;

  const isDecided = ["APPROVED", "CONDITIONS_APPLIED", "REJECTED"].includes(partner.status);
  const decidedByUser = isDecided && decision?.decidedBy ? await db.user.findUnique({ where: { id: decision.decidedBy }, select: { name: true } }) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <Link href="/fleet-onboarding" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
          <ArrowLeft className="size-3.5" /> Fleet Onboarding
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{partner.legalName}</h1>
            <p className="text-sm text-ink-muted">
              {partner.market.country} · {partner.partnerType.replace("_", " ").toLowerCase()} · {partner.reference} · completeness {partner.completenessPct}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            {partner.riskBand && <StatusBadge status={partner.riskBand} />}
            <StatusBadge status={partner.status} size="md" />
          </div>
        </div>
      </div>

      {isDecided && (
        <DecisionOutcome
          outcome={partner.status === "APPROVED" ? "approved" : partner.status === "CONDITIONS_APPLIED" ? "conditions" : "rejected"}
          reason={decision?.humanNote}
          by={decidedByUser?.name}
          at={decision?.decidedAt ? new Date(decision.decidedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : null}
        />
      )}

      {partner.aiElapsedMs != null && <TimeSavedBanner manualMinutes={partner.manualBaselineMinutes} actualMs={partner.aiElapsedMs} />}

      {/* documents + pipeline — one row so the pipeline aligns to the document panel's bottom */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Panel title="Documents" icon={FileText}>
            <DocumentViewer documents={docViews} />
          </Panel>
        </div>
        <div className="lg:col-span-4">
          <PipelineStepper
            className={initialRunId ? "h-full" : undefined}
            processUrl={`/api/partners/${partner.id}/process`}
            initialRunId={initialRunId}
            canStart={canStart}
            startLabel="Run onboarding pipeline"
            startBlurb="Extract documents, validate against market rules, cross-check, score risk, and draft a decision."
          />
        </div>
      </div>

      {/* beneath: the human decision + risk (wide) · required-document checklist & validation (rail) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {decision && (
            <Panel title="Decision draft" icon={Gavel}>
              <div className="mb-3 border-b border-border pb-3">
                <DecisionActions
                  partnerId={partner.id}
                  status={partner.status}
                  hint={decision.draft ? "AI recommendation — human decides" : undefined}
                  hintStatus={decision.draft ? (decision.outcome === "APPROVE" ? "APPROVED" : decision.outcome === "REJECT" ? "REJECTED" : "CONDITIONS_APPLIED") : undefined}
                  hintLabel={decision.draft ? decision.outcome.replace(/_/g, " ").toLowerCase() : undefined}
                />
              </div>
              <div className="rounded-md bg-surface-subtle p-3">
                <p className="text-xs text-ink">{decision.rationale}</p>
                {decision.conditions.length > 0 && (
                  <ul className="mt-2 space-y-1 text-2xs text-ink-muted">
                    {decision.conditions.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5"><AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning" /> {c}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-2"><ConfidenceMeter value={decision.confidence} /></div>
              </div>
            </Panel>
          )}

          {risk && (
            <Panel title="Risk assessment" icon={ShieldAlert}>
              <div className="flex items-center justify-between">
                <span className="tabular-data text-3xl font-semibold text-ink">{risk.score}</span>
                <StatusBadge status={risk.band} size="md" />
              </div>
              <p className="mt-2 text-xs text-ink-muted">{risk.explanation}</p>
              <div className="mt-3 space-y-2">
                {factors.map((f, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-2xs">
                      <span className="text-ink">{f.label}</span>
                      <span className="tabular-data text-ink-muted">+{f.contribution}</span>
                    </div>
                    <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <div className="h-full rounded-full bg-warning" style={{ width: `${Math.min(100, f.contribution)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-5 lg:col-span-4">
          <Panel title={`Required documents · ${presentTypes.size}/${required.length}`} icon={ListChecks}>
            <ul className="space-y-1.5 text-xs">
              {required.map((d) => {
                const present = presentTypes.has(d.docType);
                return (
                  <li key={d.docType} className="flex items-center gap-2">
                    {present ? <CheckCircle2 className="size-3.5 text-success" /> : <XCircle className="size-3.5 text-danger" />}
                    <span className={present ? "text-ink" : "text-danger"}>{d.label}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {(partner.validations.length > 0 || partner.crossChecks.length > 0) && (
            <Panel title="Validation & cross-checks" icon={ListChecks}>
              <ul className="scroll-slim max-h-[340px] space-y-1.5 overflow-y-auto pr-1 text-xs">
                {partner.crossChecks.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <StatusBadge status={c.outcome} />
                    <span className="text-ink-muted">{c.message}{c.outcome === "MISMATCH" && c.valueA ? ` (“${c.valueA}” ≠ “${c.valueB}”)` : ""}</span>
                  </li>
                ))}
                {partner.validations.filter((v) => v.outcome !== "PASS").map((v) => (
                  <li key={v.id} className="flex items-start gap-2">
                    <StatusBadge status={v.outcome} />
                    <span className="text-ink-muted">{v.message}</span>
                  </li>
                ))}
                {partner.validations.every((v) => v.outcome === "PASS") && partner.validations.length > 0 && (
                  <li className="flex items-center gap-2 text-success"><CheckCircle2 className="size-3.5" /> All {partner.validations.length} document rules passed</li>
                )}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
