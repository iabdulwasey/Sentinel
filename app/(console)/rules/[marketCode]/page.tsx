import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ListChecks, ShieldCheck, ShieldAlert, FileSpreadsheet, Gauge, Globe2, ExternalLink, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { resolveRulesetEntry } from "@/engine/rules/store";
import { Panel } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import type { MarketRuleset } from "@/engine/types/ruleset";

export const dynamic = "force-dynamic";

const SEV: Record<string, string> = {
  INFO: "bg-surface-sunken text-ink-muted",
  LOW: "bg-surface-sunken text-ink-muted",
  MEDIUM: "bg-warning-muted text-warning",
  HIGH: "bg-warning-muted text-warning",
  CRITICAL: "bg-danger-muted text-danger",
};
function Sev({ s }: { s: string }) {
  return <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", SEV[s] ?? SEV.INFO)}>{s}</span>;
}
function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "brand" | "warning" | "danger" }) {
  const c = tone === "brand" ? "bg-brand-50 text-brand-700" : tone === "warning" ? "bg-warning-muted text-warning" : tone === "danger" ? "bg-danger-muted text-danger" : "bg-surface-sunken text-ink-muted";
  return <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-medium", c)}>{children}</span>;
}

export default async function MarketRulesetPage({ params, searchParams }: { params: Promise<{ marketCode: string }>; searchParams: Promise<{ v?: string }> }) {
  const { marketCode } = await params;
  const { v } = await searchParams;
  const market = await db.market.findUnique({ where: { code: marketCode } });
  if (!market) notFound();

  const versions = await db.regulatoryRuleset.findMany({ where: { marketId: market.id }, orderBy: { version: "asc" } });
  const selectedVersion = v ? parseInt(v, 10) : market.activeRulesetVersion;
  let ruleset: MarketRuleset;
  let hash: string;
  try {
    const entry = await resolveRulesetEntry(market.code, selectedVersion);
    ruleset = entry.ruleset;
    hash = entry.hash;
  } catch {
    notFound();
  }
  const policy = ruleset.compliancePolicy;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* header */}
      <div className="space-y-3">
        <Link href="/rules" className="meta inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="size-3.5" /> Markets & Rules
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-xl font-semibold tracking-[-0.012em] text-ink">{ruleset.country} · {market.cities ? (market.cities as string[]).join(" / ") : ""}</h1>
            <p className="meta flex items-center gap-1.5">
              {ruleset.regulator.name} ({ruleset.regulator.code})
              {ruleset.regulator.website && (
                <a href={ruleset.regulator.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-700 hover:underline">
                  <ExternalLink className="size-3" /> site
                </a>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Chip tone={policy.privacyRegime === "GDPR" ? "brand" : "warning"}>{policy.privacyRegime}</Chip>
              <Chip>{ruleset.region}</Chip>
              <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium", policy.dataResidency.crossBorderTransferAllowed ? "bg-success-muted text-success" : "bg-warning-muted text-warning")}>
                <Globe2 className="size-3" /> {policy.dataResidency.crossBorderTransferAllowed ? "Cross-border OK" : "Residency restricted"}
              </span>
              <Chip>{ruleset.timezone}</Chip>
              <Chip>{ruleset.currency}</Chip>
              <Chip>locale {ruleset.locale}</Chip>
            </div>
          </div>
        </div>
        <div className="meta">Zones: {ruleset.zones.join(" · ")}</div>
      </div>

      {/* version history */}
      <Panel title="Ruleset versions" icon={FileSpreadsheet} flush>
        <ul className="divide-y divide-border">
          {versions.map((ver) => {
            const isSel = ver.version === selectedVersion;
            const changelog = ver.changelog as { added?: string[]; note?: string } | null;
            return (
              <li key={ver.id}>
                <Link href={`/rules/${market.code}?v=${ver.version}`} className={cn("row-link flex items-center justify-between gap-3 px-5 py-3", isSel && "bg-brand-50/50")}>
                  <div className="flex items-center gap-3">
                    <span className="tabular-data text-sm font-semibold text-ink">v{ver.version}</span>
                    {ver.version === market.activeRulesetVersion && <Chip tone="brand">Active</Chip>}
                    {isSel && ver.version !== market.activeRulesetVersion && <Chip>Viewing</Chip>}
                    <span className="meta">{ver.summary}{changelog?.added?.length ? ` · added: ${changelog.added.join(", ")}` : ""}</span>
                  </div>
                  <span className="meta tabular-data">{ver.contentHash.slice(0, 12)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* required documents */}
      <Panel title={`Required documents · ${ruleset.requiredDocuments.length}`} icon={FileText} flush bodyClassName="px-2 py-1">
        <Accordion type="multiple" className="w-full">
          {ruleset.requiredDocuments.map((d) => (
            <AccordionItem key={d.docType} value={d.docType} className="border-border px-3">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                  <div className="min-w-0 text-left">
                    <div className="truncate text-sm font-medium text-ink">{d.label}</div>
                    <div className="meta tabular-data">{d.docType}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {d.requiredFor.map((rf) => <Chip key={rf}>{rf.toLowerCase()}</Chip>)}
                    {d.validityMonths && <span className="meta">{d.validityMonths}mo</span>}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <div className="eyebrow mb-1.5">Expected fields</div>
                    <ul className="space-y-1">
                      {d.expectedFields.map((f) => (
                        <li key={f.key} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-ink">{f.label} <span className="meta tabular-data">· {f.key}</span></span>
                          <span className="flex items-center gap-1">
                            <Chip>{f.type}</Chip>
                            {f.piiClass && f.piiClass !== "NONE" && <Chip tone="warning">{f.piiClass}</Chip>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="eyebrow mb-1.5">Validation rules</div>
                    <ul className="space-y-1.5">
                      {d.validations.map((r) => (
                        <li key={r.id} className="text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-ink">{r.description}</span>
                            <Sev s={r.severity} />
                          </div>
                          <div className="meta tabular-data">{r.field} · {r.operator}{r.value !== undefined ? ` · ${JSON.stringify(r.value)}` : ""}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* authority fields */}
        <Panel title={`Authority-answerable fields · ${ruleset.authorityFields.length}`} icon={ListChecks} flush>
          <ul className="divide-y divide-border">
            {ruleset.authorityFields.map((f) => (
              <li key={f.key} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">{f.label}</div>
                    <div className="meta tabular-data">{f.key} · {f.dataClass}{f.source ? ` · ${f.source.aggregation}(${f.source.entity})` : ""}</div>
                  </div>
                  <StatusBadge status={f.classification === "ANSWERABLE" ? "PASS" : f.classification === "OUT_OF_SCOPE" ? "FAIL" : "WARN"} label={f.classification.replace("_", " ").toLowerCase()} />
                </div>
                {f.cautionNote && <div className="mt-1 text-[11px] leading-relaxed text-warning">{f.cautionNote}</div>}
              </li>
            ))}
          </ul>
        </Panel>

        {/* cross-checks + report format + risk model */}
        <div className="space-y-6">
          <Panel title={`Cross-document checks · ${ruleset.crossDocumentChecks.length}`} icon={ShieldCheck}>
            <ul className="space-y-2.5 text-xs">
              {ruleset.crossDocumentChecks.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-ink">{c.description}</div>
                    <div className="meta tabular-data">{c.docTypeA}.{c.fieldA} ↔ {c.docTypeB}.{c.fieldB}</div>
                  </div>
                  <Sev s={c.severity} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Mandated report format" icon={FileSpreadsheet}>
            <dl className="space-y-1.5 text-xs">
              <Row k="Format ID" v={ruleset.reportFormat.formatId} />
              <Row k="Mandated by" v={ruleset.reportFormat.mandatedBy} />
              <Row k="Delivery" v={ruleset.reportFormat.delivery} />
              <Row k="Date format" v={ruleset.reportFormat.dateFormat} />
              <Row k="Number format" v={`${ruleset.reportFormat.numberFormat.decimal} dec · ${ruleset.reportFormat.numberFormat.thousands || "—"} thousands`} />
              <Row k="Language" v={ruleset.reportFormat.language} />
            </dl>
            <div className="mt-3 border-t border-border pt-2.5">
              <div className="eyebrow mb-1.5">Sections</div>
              <div className="flex flex-wrap gap-1.5">{ruleset.reportFormat.sections.map((s) => <Chip key={s.id}>{s.heading}</Chip>)}</div>
            </div>
          </Panel>

          <Panel title="Risk model" icon={Gauge}>
            <ul className="space-y-2 text-xs">
              {ruleset.riskModel.factors.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <span className="text-ink">{f.label}</span>
                  <span className="meta tabular-data">weight {f.weight}</span>
                </li>
              ))}
            </ul>
            <div className="meta mt-2 border-t border-border pt-2 tabular-data">
              Bands — low {ruleset.riskModel.bands.low.join("–")} · medium {ruleset.riskModel.bands.medium.join("–")} · high {ruleset.riskModel.bands.high.join("–")}
            </div>
          </Panel>
        </div>
      </div>

      {/* compliance policy */}
      <Panel title="Compliance policy (§7.A)" icon={ShieldAlert}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <div className="eyebrow mb-1.5">Data residency</div>
            <dl className="space-y-1 text-xs">
              <Row k="Storage region" v={policy.dataResidency.storageRegion} />
              <Row k="Cross-border transfer" v={policy.dataResidency.crossBorderTransferAllowed ? "Permitted" : "Restricted by default"} />
              <Row k="Allowed regions" v={policy.dataResidency.allowedTransferRegions.join(", ") || "none"} />
            </dl>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{policy.dataResidency.note}</p>
          </div>
          <div>
            <div className="eyebrow mb-1.5">Retention & purpose</div>
            <dl className="space-y-1 text-xs">
              <Row k="Document retention" v={`${policy.retention.documentRetentionMonths} months`} />
              <Row k="Audit retention" v={`${policy.retention.auditLogRetentionMonths} months`} />
              <Row k="Auto-purge" v={policy.retention.autoPurgeAfterRetention ? "yes" : "no"} />
              <Row k="Declared purposes" v={policy.purposeLimitation.declaredPurposes.join(", ")} />
            </dl>
            {policy.purposeLimitation.restrictedDisclosureFieldKeys.length > 0 && (
              <div className="mt-2">
                <div className="eyebrow mb-1">Restricted disclosure</div>
                <div className="flex flex-wrap gap-1.5">{policy.purposeLimitation.restrictedDisclosureFieldKeys.map((k) => <Chip key={k} tone="warning">{k}</Chip>)}</div>
              </div>
            )}
          </div>
          <div>
            <div className="eyebrow mb-1.5">Lawful bases</div>
            <ul className="space-y-1.5 text-xs">
              {policy.lawfulBases.map((b) => (
                <li key={b.tag}>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="size-3 text-success" /> <span className="font-medium text-ink">{b.label}</span></div>
                  <div className="meta tabular-data">{b.tag} · applies to {b.appliesToFieldKeys.length} fields</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-1.5">PII classification</div>
            <ul className="space-y-1 text-xs">
              {policy.piiClassification.map((p) => (
                <li key={p.fieldKey} className="flex items-center justify-between gap-2">
                  <span className="tabular-data text-ink">{p.fieldKey}</span>
                  <Chip tone={p.piiClass === "SPECIAL_CATEGORY" || p.piiClass === "SENSITIVE" ? "danger" : "warning"}>{p.piiClass}</Chip>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
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
