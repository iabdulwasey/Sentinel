export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { renderReportPdf } from "@/lib/report-pdf";
import type { GeneratedReport } from "@/engine/types/ai";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const format = new URL(req.url).searchParams.get("format") ?? "pdf";

  const reqRow = await db.authorityRequest.findUnique({ where: { id }, include: { market: true } });
  if (!reqRow || !reqRow.generatedReport) return fail("No generated report to export", 404);
  const report = reqRow.generatedReport as unknown as GeneratedReport;

  if (format === "json") {
    const payload = {
      reference: reqRow.reference,
      market: reqRow.market.country,
      authority: reqRow.authority,
      generatedReport: report,
      generatedAt: new Date().toISOString(),
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${reqRow.reference}.json"` },
    });
  }

  const pdf = await renderReportPdf({
    report,
    reference: reqRow.reference,
    marketCountry: reqRow.market.country,
    regulator: reqRow.authority,
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    elapsedMs: reqRow.aiElapsedMs,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${reqRow.reference}.pdf"` },
  });
}
