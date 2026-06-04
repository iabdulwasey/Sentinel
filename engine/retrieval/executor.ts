import { addDays } from "date-fns";
import { Prisma } from "@prisma/client";
import { db } from "../../lib/db";
import type { MarketRuleset, AnswerableFieldSpec, RuleOperator } from "../types/ruleset";
import type { RequestIntent, RetrievalComputedField, RetrievalResult, ProvenanceRef } from "../types/ai";

/**
 * Deterministic retrieval executor — the ONLY component that runs DB queries in the AI path.
 * It computes each answerable field from real rows, scoped to the market and the request's
 * filters (zone/period/status), and tags every figure with the exact source row ids. The LLM
 * never queries the DB; it only plans which fields and narrates the results.
 */

const MAX_PROV_IDS = 100;

async function getAsOf(): Promise<Date> {
  const meta = await db.appMeta.findUnique({ where: { key: "seedAnchor" } });
  const v = meta?.value as { date?: string } | null;
  return v?.date ? new Date(v.date) : new Date();
}

function namedFilterWhere(rs: MarketRuleset, ruleId: string, asOf: Date): Record<string, unknown> {
  const f = rs.namedFilters?.[ruleId];
  if (!f) return {};
  const op = f.operator as RuleOperator;
  switch (op) {
    case "EQUALS":
      return { [f.field]: f.value };
    case "NOT_EQUALS":
      return { [f.field]: { not: f.value } };
    case "DATE_NOT_EXPIRED":
      return { [f.field]: { gte: asOf } };
    case "DATE_WITHIN_DAYS":
      return { [f.field]: { gte: asOf, lte: addDays(asOf, Number(f.value ?? 30)) } };
    case "GTE":
      return { [f.field]: { gte: f.value } };
    case "LTE":
      return { [f.field]: { lte: f.value } };
    case "NOT_EMPTY":
    case "EXISTS":
      return { [f.field]: { not: null } };
    default:
      return {};
  }
}

function makeField(
  spec: AnswerableFieldSpec,
  value: number | string | Array<Record<string, unknown>>,
  prov: ProvenanceRef,
): RetrievalComputedField {
  return { fieldKey: spec.key, label: spec.label, value, classification: spec.classification, provenance: [prov] };
}

export async function executeRetrieval(opts: {
  ruleset: MarketRuleset;
  marketId: string;
  intent: RequestIntent;
  fieldKeys: string[];
}): Promise<RetrievalResult> {
  const { ruleset, marketId, intent, fieldKeys } = opts;
  const asOf = await getAsOf();
  const reqZone = intent.filters?.zone ?? null;
  const pStart = intent.filters?.periodStart ? new Date(intent.filters.periodStart) : null;
  const pEnd = intent.filters?.periodEnd ? new Date(intent.filters.periodEnd) : null;
  const periodDesc =
    pStart || pEnd ? `${pStart ? pStart.toISOString().slice(0, 10) : "…"} → ${pEnd ? pEnd.toISOString().slice(0, 10) : "…"}` : "all time";

  const fields: RetrievalComputedField[] = [];
  const rowSamples: Record<string, Array<{ id: string; [k: string]: unknown }>> = {};

  for (const key of fieldKeys) {
    const spec = ruleset.authorityFields.find((f) => f.key === key);
    if (!spec || !spec.source) continue;
    const src = spec.source;

    if (src.entity === "Driver") {
      const where: Record<string, unknown> = { partner: { marketId, deletedAt: null }, deletedAt: null };
      for (const rid of src.filterRuleIds ?? []) Object.assign(where, namedFilterWhere(ruleset, rid, asOf));
      const rows = await db.driver.findMany({ where: where as Prisma.DriverWhereInput, take: 1000 });
      const filterDesc = `drivers in market${(src.filterRuleIds ?? []).length ? ` where ${(src.filterRuleIds ?? []).join(", ")}` : ""}`;
      if (src.aggregation === "list") {
        const value = rows.map((d) => ({
          id: d.id,
          name: d.fullName,
          licenseNo: d.licenseNo,
          expiresAt: d.licenseExpiresAt,
          valid: d.licenseExpiresAt ? d.licenseExpiresAt >= asOf : false,
        }));
        fields.push(makeField(spec, value, { entity: "Driver", ids: rows.slice(0, MAX_PROV_IDS).map((d) => d.id), aggregation: "list", filterDescription: filterDesc }));
      } else {
        fields.push(makeField(spec, rows.length, { entity: "Driver", ids: rows.slice(0, MAX_PROV_IDS).map((d) => d.id), aggregation: "count", filterDescription: filterDesc }));
      }
      rowSamples.Driver = rows.slice(0, 6).map((d) => ({ id: d.id, name: d.fullName, licenseExpiresAt: d.licenseExpiresAt?.toISOString() ?? null }));
    } else if (src.entity === "Vehicle") {
      const where: Record<string, unknown> = { partner: { marketId, deletedAt: null }, deletedAt: null };
      for (const rid of src.filterRuleIds ?? []) Object.assign(where, namedFilterWhere(ruleset, rid, asOf));
      const rows = await db.vehicle.findMany({ where: where as Prisma.VehicleWhereInput, take: 2000 });
      const filterDesc = `vehicles in market${(src.filterRuleIds ?? []).length ? ` where ${(src.filterRuleIds ?? []).join(", ")}` : ""}`;
      if (src.aggregation === "list") {
        const value = rows.map((v) => ({ id: v.id, plate: v.plate, inspectionValidUntil: v.inspectionValidUntil }));
        fields.push(makeField(spec, value, { entity: "Vehicle", ids: rows.slice(0, MAX_PROV_IDS).map((v) => v.id), aggregation: "list", filterDescription: filterDesc }));
      } else {
        fields.push(makeField(spec, rows.length, { entity: "Vehicle", ids: rows.slice(0, MAX_PROV_IDS).map((v) => v.id), aggregation: "count", filterDescription: filterDesc }));
      }
      rowSamples.Vehicle = rows.slice(0, 6).map((v) => ({ id: v.id, plate: v.plate, inspectionValidUntil: v.inspectionValidUntil?.toISOString() ?? null }));
    } else if (src.entity === "Trip") {
      const where: Record<string, unknown> = { partner: { marketId }, deletedAt: null };
      if (reqZone) {
        // canonicalize a possibly-verbose requested zone to a ruleset zone token
        const canonical = ruleset.zones.find((z) => reqZone.toLowerCase().includes(z.toLowerCase())) ?? reqZone;
        where.zone = { contains: canonical };
      }
      if (pStart || pEnd) where.startedAt = { ...(pStart ? { gte: pStart } : {}), ...(pEnd ? { lte: pEnd } : {}) };
      const filterDesc = `completed trips · zone=${reqZone ?? "any"} · period ${periodDesc}`;
      if (src.aggregation === "sum" && src.field) {
        const rows = await db.trip.findMany({ where: where as Prisma.TripWhereInput, take: 5000 });
        const sum = rows.reduce((a, t) => a + (Number((t as Record<string, unknown>)[src.field!] ?? 0)), 0);
        fields.push(makeField(spec, sum, { entity: "Trip", ids: rows.slice(0, MAX_PROV_IDS).map((t) => t.id), aggregation: "sum", field: src.field, filterDescription: filterDesc }));
      } else {
        const rows = await db.trip.findMany({ where: where as Prisma.TripWhereInput, select: { id: true }, take: 5000 });
        fields.push(makeField(spec, rows.length, { entity: "Trip", ids: rows.slice(0, MAX_PROV_IDS).map((t) => t.id), aggregation: "count", filterDescription: filterDesc }));
      }
      const sampleTrips = await db.trip.findMany({ where: where as Prisma.TripWhereInput, take: 6, orderBy: { startedAt: "desc" } });
      rowSamples.Trip = sampleTrips.map((t) => ({ id: t.id, zone: t.zone, startedAt: t.startedAt.toISOString() }));
    } else if (src.entity === "FleetPartner") {
      const where: Record<string, unknown> = { marketId, deletedAt: null };
      for (const rid of src.filterRuleIds ?? []) Object.assign(where, namedFilterWhere(ruleset, rid, asOf));
      const rows = await db.fleetPartner.findMany({ where: where as Prisma.FleetPartnerWhereInput, take: 500 });
      const filterDesc = "fleet partners in market";
      if (src.aggregation === "list") {
        const value = rows.map((p) => ({ id: p.id, name: p.legalName, reference: p.reference, riskBand: p.riskBand }));
        fields.push(makeField(spec, value, { entity: "FleetPartner", ids: rows.slice(0, MAX_PROV_IDS).map((p) => p.id), aggregation: "list", filterDescription: filterDesc }));
      } else {
        fields.push(makeField(spec, rows.length, { entity: "FleetPartner", ids: rows.slice(0, MAX_PROV_IDS).map((p) => p.id), aggregation: "count", filterDescription: filterDesc }));
      }
      rowSamples.FleetPartner = rows.slice(0, 6).map((p) => ({ id: p.id, name: p.legalName, reference: p.reference }));
    }
  }

  return { fields, rowSamples };
}
