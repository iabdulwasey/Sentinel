"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowRight, FileText, ListChecks, ShieldCheck, Globe2, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface MarketSummary {
  code: string;
  country: string;
  cities: string[];
  regulator: string;
  regulatorCode: string;
  regime: string;
  region: string;
  crossBorder: boolean;
  activeVersion: number;
  hash: string;
  currency: string;
  docs: number;
  fields: number;
  checks: number;
  zones: number;
  keywords: string;
}

function RegimeBadge({ regime }: { regime: string }) {
  const tone = regime === "GDPR" ? "bg-brand-50 text-brand-700" : "bg-warning-muted text-warning";
  return <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-medium", tone)}>{regime}</span>;
}

export function RulesExplorer({ summaries, initialMarket }: { summaries: MarketSummary[]; initialMarket: string }) {
  const [q, setQ] = useState("");
  const [regime, setRegime] = useState("ALL");
  const [region, setRegion] = useState("ALL");
  const [residency, setResidency] = useState("ALL");

  const filtered = useMemo(() => {
    return summaries.filter((m) => {
      if (initialMarket !== "ALL" && m.code !== initialMarket) return false;
      if (q && !m.keywords.includes(q.toLowerCase())) return false;
      if (regime !== "ALL" && m.regime !== regime) return false;
      if (region !== "ALL" && m.region !== region) return false;
      if (residency === "OK" && !m.crossBorder) return false;
      if (residency === "RESTRICTED" && m.crossBorder) return false;
      return true;
    });
  }, [summaries, initialMarket, q, regime, region, residency]);

  return (
    <div className="space-y-5">
      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search markets, regulators, document types…"
            className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand-400"
          />
        </div>
        <FilterSelect value={regime} onChange={setRegime} placeholder="Regime" options={[["ALL", "All regimes"], ["GDPR", "GDPR"], ["NDPA", "NDPA"], ["POPIA", "POPIA"]]} />
        <FilterSelect value={region} onChange={setRegion} placeholder="Region" options={[["ALL", "All regions"], ["EU", "EU"], ["NG", "Nigeria"], ["ZA", "South Africa"]]} />
        <FilterSelect value={residency} onChange={setResidency} placeholder="Residency" options={[["ALL", "Any residency"], ["OK", "Cross-border OK"], ["RESTRICTED", "Restricted"]]} />
        <span className="meta ml-auto tabular-data">{filtered.length} of {summaries.length} markets</span>
      </div>

      {/* cards */}
      {filtered.length === 0 ? (
        <div className="panel px-5 py-12 text-center text-sm text-ink-muted">No markets match these filters.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <Link key={m.code} href={`/rules/${m.code}`} className="panel panel-interactive group flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[15px] font-semibold text-ink group-hover:text-brand-700">{m.country}</h3>
                    <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">{m.region}</span>
                  </div>
                  <div className="meta mt-0.5 flex items-center gap-1 truncate"><MapPin className="size-3 shrink-0" /> {m.cities.join(" · ")}</div>
                </div>
                <ArrowRight className="size-4 shrink-0 -translate-x-1 text-ink-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </div>

              <div className="text-xs leading-relaxed text-ink-muted">{m.regulator}</div>

              <div className="flex flex-wrap items-center gap-1.5">
                <RegimeBadge regime={m.regime} />
                <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium", m.crossBorder ? "bg-success-muted text-success" : "bg-warning-muted text-warning")}>
                  <Globe2 className="size-3" /> {m.crossBorder ? "Cross-border OK" : "Residency restricted"}
                </span>
              </div>

              <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                <Stat icon={FileText} value={m.docs} label="documents" />
                <Stat icon={ListChecks} value={m.fields} label="fields" />
                <Stat icon={ShieldCheck} value={m.checks} label="cross-checks" />
              </div>
              <div className="meta tabular-data flex items-center justify-between">
                <span>v{m.activeVersion} · {m.hash}</span>
                <span>{m.zones} zones · {m.currency}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-40 rounded-md border-border text-sm shadow-none">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>{l}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof FileText; value: number; label: string }) {
  return (
    <div>
      <div className="tabular-data flex items-center justify-center gap-1 text-sm font-semibold text-ink"><Icon className="size-3.5 text-ink-muted" /> {value}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
    </div>
  );
}
