import { addDays } from "date-fns";
import { db } from "../../lib/db";
import { getAsOf, resolveMarketId } from "../../lib/anchor";
import { callLlm } from "../../engine/llm/client";
import { GroundedAnswerSchema, type GroundedAnswer } from "../../engine/types/ai";

/**
 * Conversational assistant. Gathers a bounded, grounded snapshot of the platform (scoped to the
 * market filter), then the AssistantAgent answers with citations to real records. Answers are
 * grounded ONLY in the provided context — the agent flags when it can't answer rather than guessing.
 */
export async function answerQuestion(question: string, marketCode?: string | null): Promise<GroundedAnswer> {
  const marketId = await resolveMarketId(marketCode);
  const asOf = await getAsOf();
  const pScope = marketId ? { marketId } : {};
  const horizon = addDays(asOf, 30);

  const [requests, atRisk, expiringVehicles, events, partnerCounts] = await Promise.all([
    db.authorityRequest.findMany({
      where: { deletedAt: null, ...pScope },
      include: { market: true },
      orderBy: { receivedAt: "desc" },
      take: 15,
    }),
    db.fleetPartner.findMany({
      where: { deletedAt: null, ...pScope, monitoringStatus: { in: ["EXPIRING_SOON", "DRIFT_DETECTED", "PENDING_REVIEW", "SUSPENDED_RECOMMENDED"] } },
      include: { market: true },
      orderBy: { riskScore: "desc" },
      take: 10,
    }),
    db.vehicle.findMany({
      where: { partner: { deletedAt: null, ...pScope }, OR: [{ inspectionValidUntil: { gte: asOf, lte: horizon } }, { insuranceValidUntil: { gte: asOf, lte: horizon } }] },
      include: { partner: { select: { id: true, legalName: true, market: { select: { country: true } } } } },
      take: 20,
    }),
    db.complianceEvent.findMany({ where: { resolvedAt: null, ...(marketId ? { marketId } : {}) }, include: { partner: { select: { legalName: true } } }, orderBy: { occurredAt: "desc" }, take: 12 }),
    db.fleetPartner.groupBy({ by: ["monitoringStatus"], where: { deletedAt: null, ...pScope, status: { in: ["APPROVED", "CONDITIONS_APPLIED"] } }, _count: true }),
  ]);

  const context = {
    asOf: asOf.toISOString().slice(0, 10),
    marketFilter: marketCode ?? "all markets",
    authorityRequests: requests.map((r) => ({ entity: "AuthorityRequest", id: r.id, href: `/authority-requests/${r.id}`, reference: r.reference, title: r.title, market: r.market.country, authority: r.authority, status: r.status, deadline: r.deadlineAt?.toISOString().slice(0, 10) ?? null })),
    atRiskPartners: atRisk.map((p) => ({ entity: "FleetPartner", id: p.id, href: `/compliance-monitoring/partners/${p.id}`, name: p.legalName, market: p.market.country, monitoringStatus: p.monitoringStatus, risk: p.riskScore, reason: p.monitoringReason })),
    upcomingExpiries: expiringVehicles.map((v) => ({ partner: v.partner.legalName, partnerId: v.partner.id, market: v.partner.market.country, plate: v.plate, inspection: v.inspectionValidUntil?.toISOString().slice(0, 10) ?? null, insurance: v.insuranceValidUntil?.toISOString().slice(0, 10) ?? null })),
    recentAlerts: events.map((e) => ({ type: e.type, severity: e.severity, title: e.title, partner: e.partner?.legalName ?? null })),
    portfolioByStatus: partnerCounts.map((c) => ({ status: c.monitoringStatus, count: c._count })),
  };

  const res = await callLlm({
    agent: "AssistantAgent",
    stage: "ASSISTANT",
    promptId: "assistant.grounded",
    schema: GroundedAnswerSchema,
    schemaName: "GroundedAnswer",
    maxTokens: 4000,
    vars: { market: context.marketFilter, question, context },
  });
  return res.data;
}
