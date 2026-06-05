export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { guard, ok, fail } from "@/lib/api";
import { db } from "@/lib/db";

/** Live preview of a record behind an inline chat link — powers the click-to-preview popover. */
type Field = { label: string; value: string; tone?: "success" | "warning" | "danger" };
type Preview = { kind: string; title: string; subtitle?: string; href: string; fields: Field[] };

const monitoringTone = (s: string): Field["tone"] => (["COMPLIANT", "REMEDIATED"].includes(s) ? "success" : ["SUSPENDED_RECOMMENDED", "DRIFT_DETECTED"].includes(s) ? "danger" : "warning");
const riskTone = (b: string): Field["tone"] => (b === "LOW" ? "success" : b === "MEDIUM" ? "warning" : "danger");
const arrTone = (s: string): Field["tone"] => (["APPROVED", "DONE"].includes(s) ? "success" : s === "REJECTED" ? "danger" : ["PENDING_REVIEW", "NEEDS_CLARIFICATION"].includes(s) ? "warning" : undefined);
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase();

function parse(href: string): { kind: "partner" | "request" | "market"; id: string } | null {
  let m: RegExpMatchArray | null;
  if ((m = href.match(/^\/compliance-monitoring\/partners\/([^/?#]+)/))) return { kind: "partner", id: m[1] };
  if ((m = href.match(/^\/fleet-onboarding\/([^/?#]+)/))) return { kind: "partner", id: m[1] };
  if ((m = href.match(/^\/authority-requests\/([^/?#]+)/))) return { kind: "request", id: m[1] };
  if ((m = href.match(/^\/rules\/([^/?#]+)/))) return { kind: "market", id: m[1] };
  return null;
}

export async function GET(req: NextRequest) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const href = req.nextUrl.searchParams.get("href") ?? "";
  const ref = parse(href);
  if (!ref) return fail("Unsupported link.", 400);

  let preview: Preview | null = null;
  if (ref.kind === "partner") {
    const p = await db.fleetPartner.findUnique({ where: { id: ref.id }, include: { market: true } });
    if (p) preview = {
      kind: "Fleet partner", title: p.legalName, subtitle: `${p.market.country} · ${titleCase(p.partnerType)}`, href,
      fields: [
        { label: "Onboarding", value: titleCase(p.status) },
        { label: "Monitoring", value: titleCase(p.monitoringStatus), tone: monitoringTone(p.monitoringStatus) },
        ...(p.riskBand ? [{ label: "Risk", value: `${p.riskScore ?? "—"} · ${p.riskBand.toLowerCase()}`, tone: riskTone(p.riskBand) } as Field] : []),
        ...(p.monitoringReason ? [{ label: "Reason", value: p.monitoringReason } as Field] : []),
      ],
    };
  } else if (ref.kind === "request") {
    const r = await db.authorityRequest.findUnique({ where: { id: ref.id }, include: { market: true } });
    if (r) preview = {
      kind: "Authority request", title: r.title, subtitle: `${r.reference} · ${r.authority}`, href,
      fields: [
        { label: "Market", value: r.market.country },
        { label: "Status", value: titleCase(r.status), tone: arrTone(r.status) },
        { label: "Deadline", value: r.deadlineAt ? r.deadlineAt.toISOString().slice(0, 10) : "—" },
      ],
    };
  } else {
    const mk = await db.market.findUnique({ where: { code: ref.id } });
    if (mk) preview = {
      kind: "Market ruleset", title: mk.country, subtitle: `${mk.regulatorCode} · ${mk.privacyRegime}`, href,
      fields: [
        { label: "Region", value: mk.region },
        { label: "Active ruleset", value: `v${mk.activeRulesetVersion}` },
        { label: "Cities", value: ((mk.cities as string[]) ?? []).join(", ") || "—" },
      ],
    };
  }

  if (!preview) return fail("Record not found.", 404);
  return ok(preview);
}
