/**
 * Re-render every existing synthetic document PDF in place, using the upgraded
 * per-document-type renderer (prisma/seed-lib/pdf.ts), without touching any DB
 * scenario state. Reads each document's ground truth + its market ruleset, rebuilds
 * a realistic, type-specific layout, and overwrites the bytes at the same storage ref.
 *
 *   npx tsx scripts/rerender-docs.ts
 */
import { db } from "../lib/db";
import { storage } from "../engine/storage";
import { resolveRuleset } from "../engine/rules/store";
import { renderDocumentPdf, buildPdfSpec } from "../prisma/seed-lib/pdf";
import { SEED_ANCHOR } from "../prisma/seed-lib/dates";

async function main() {
  const store = storage();
  const docs = await db.document.findMany({
    where: { deletedAt: null, mimeType: "application/pdf" },
    include: { market: true, partner: true, groundTruth: true },
  });
  console.log(`Re-rendering ${docs.length} document PDFs…`);

  let ok = 0;
  let fallback = 0;
  let failed = 0;

  for (const d of docs) {
    try {
      if (!d.market) throw new Error("no market");
      const ruleset = await resolveRuleset(d.market.code, d.market.activeRulesetVersion);
      const issuedAt = d.issuedAt ?? SEED_ANCHOR;
      const expiresAt = d.expiresAt ?? SEED_ANCHOR;
      const expired = !!d.expiresAt && d.expiresAt.getTime() < SEED_ANCHOR.getTime();

      const gt = (d.groundTruth?.fields as Record<string, string> | undefined) ?? null;
      const defects = (d.groundTruth?.injectedDefects as { type?: string }[] | undefined) ?? [];
      const lowLegibility =
        (d.extractionConfidence != null && d.extractionConfidence < 0.6) || defects.some((x) => x.type === "LOW_LEGIBILITY");
      const reference = `${d.docType}/${d.partner?.reference ?? d.id.slice(0, 8).toUpperCase()}`;
      const spec = ruleset.requiredDocuments.find((s) => s.docType === d.docType);
      if (!spec || !gt) fallback++;

      const pdfSpec = buildPdfSpec({
        docType: d.docType,
        label: d.title,
        country: ruleset.country,
        authority: ruleset.regulator.name,
        expectedFields: spec?.expectedFields ?? [],
        gt: gt ?? {},
        issuedAt,
        expiresAt,
        dateFormat: ruleset.reportFormat.dateFormat,
        expired,
        reference,
        lowLegibility,
        partnerName: d.partner?.legalName,
      });

      const buf = await renderDocumentPdf(pdfSpec);
      const stored = await store.put(d.storageRef, buf, "application/pdf");
      await db.document.update({ where: { id: d.id }, data: { byteSize: stored.size, sha256: stored.sha256 } });
      ok++;
    } catch (e) {
      failed++;
      console.error(`  ✗ ${d.docType} ${d.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`Done. ${ok} re-rendered (${fallback} had no ground truth), ${failed} failed.`);
  process.exit(0);
}

main();
