import Link from "next/link";
import { FileUp } from "lucide-react";
import { db } from "@/lib/db";
import { resolveRulesetEntry } from "@/engine/rules/store";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { RulesExplorer, type MarketSummary } from "./_components/rules-explorer";

export const dynamic = "force-dynamic";

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const { market } = await searchParams;
  const markets = await db.market.findMany({ where: { deletedAt: null }, orderBy: { country: "asc" } });

  const summaries: MarketSummary[] = await Promise.all(
    markets.map(async (m) => {
      const { ruleset: rs, hash } = await resolveRulesetEntry(m.code, m.activeRulesetVersion);
      const policy = rs.compliancePolicy;
      return {
        code: m.code,
        country: m.country,
        cities: (m.cities as string[]) ?? [],
        regulator: rs.regulator.name,
        regulatorCode: rs.regulator.code,
        regime: policy.privacyRegime,
        region: rs.region,
        crossBorder: policy.dataResidency.crossBorderTransferAllowed,
        activeVersion: m.activeRulesetVersion,
        hash: hash.slice(0, 10),
        currency: rs.currency,
        docs: rs.requiredDocuments.length,
        fields: rs.authorityFields.length,
        checks: rs.crossDocumentChecks.length,
        zones: rs.zones.length,
        keywords: [rs.country, rs.regulator.name, rs.regulator.code, m.code, ...rs.requiredDocuments.map((d) => `${d.docType} ${d.label}`)].join(" ").toLowerCase(),
      };
    }),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Markets & Rules"
        description="The machine-readable regulatory ruleset behind every market — required documents, validation rules, authority-answerable fields, and data-residency & lawful-basis policy. Rules live in the database; adding or changing a market is a new ruleset version, not a code change."
        actions={
          <Button asChild>
            <Link href="/regulation-intake"><FileUp className="size-4" /> Import regulation</Link>
          </Button>
        }
      />
      <RulesExplorer summaries={summaries} initialMarket={market ?? "ALL"} />
    </div>
  );
}
