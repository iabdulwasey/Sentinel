import { addDays } from "date-fns";
import { db } from "../../lib/db";
import { getAsOf, resolveMarketId } from "../../lib/anchor";
import { callLlm, callLlmStream } from "../../engine/llm/client";
import { GroundedAnswerSchema, type GroundedAnswer } from "../../engine/types/ai";

/**
 * Conversational assistant. Gathers a bounded, grounded snapshot of the platform (scoped to the
 * market filter), then answers with citations to real records — grounded ONLY in that context.
 * Two paths share the same context: a structured one (answerQuestion) and a streaming one
 * (streamAnswer, which emits the markdown answer token-by-token, then a trailing JSON block).
 */
async function buildAssistantContext(marketCode?: string | null) {
  const marketId = await resolveMarketId(marketCode);
  const asOf = await getAsOf();
  const pScope = marketId ? { marketId } : {};
  const horizon = addDays(asOf, 30);

  const [requests, atRisk, expiringVehicles, events, partnerCounts] = await Promise.all([
    db.authorityRequest.findMany({ where: { deletedAt: null, ...pScope }, include: { market: true }, orderBy: { receivedAt: "desc" }, take: 15 }),
    db.fleetPartner.findMany({ where: { deletedAt: null, ...pScope, monitoringStatus: { in: ["EXPIRING_SOON", "DRIFT_DETECTED", "PENDING_REVIEW", "SUSPENDED_RECOMMENDED"] } }, include: { market: true }, orderBy: { riskScore: "desc" }, take: 10 }),
    db.vehicle.findMany({ where: { partner: { deletedAt: null, ...pScope }, OR: [{ inspectionValidUntil: { gte: asOf, lte: horizon } }, { insuranceValidUntil: { gte: asOf, lte: horizon } }] }, include: { partner: { select: { id: true, legalName: true, market: { select: { country: true } } } } }, take: 20 }),
    db.complianceEvent.findMany({ where: { resolvedAt: null, ...(marketId ? { marketId } : {}) }, include: { partner: { select: { legalName: true } } }, orderBy: { occurredAt: "desc" }, take: 12 }),
    db.fleetPartner.groupBy({ by: ["monitoringStatus"], where: { deletedAt: null, ...pScope, status: { in: ["APPROVED", "CONDITIONS_APPLIED"] } }, _count: true }),
  ]);

  return {
    asOf: asOf.toISOString().slice(0, 10),
    marketFilter: marketCode ?? "all markets",
    authorityRequests: requests.map((r) => ({ entity: "AuthorityRequest", id: r.id, href: `/authority-requests/${r.id}`, reference: r.reference, title: r.title, market: r.market.country, authority: r.authority, status: r.status, deadline: r.deadlineAt?.toISOString().slice(0, 10) ?? null })),
    atRiskPartners: atRisk.map((p) => ({ entity: "FleetPartner", id: p.id, href: `/compliance-monitoring/partners/${p.id}`, name: p.legalName, market: p.market.country, monitoringStatus: p.monitoringStatus, risk: p.riskScore, reason: p.monitoringReason })),
    upcomingExpiries: expiringVehicles.map((v) => ({ partner: v.partner.legalName, partnerId: v.partner.id, market: v.partner.market.country, plate: v.plate, inspection: v.inspectionValidUntil?.toISOString().slice(0, 10) ?? null, insurance: v.insuranceValidUntil?.toISOString().slice(0, 10) ?? null })),
    recentAlerts: events.map((e) => ({ type: e.type, severity: e.severity, title: e.title, partner: e.partner?.legalName ?? null })),
    portfolioByStatus: partnerCounts.map((c) => ({ status: c.monitoringStatus, count: c._count })),
  };
}

function historyBlock(history?: Array<{ role: string; text: string }>): string {
  if (!history || history.length === 0) return "";
  return `Prior conversation:\n${history.slice(-6).map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n")}`;
}

/** Structured (non-streaming) — used by the legacy endpoint and tests. */
export async function answerQuestion(question: string, marketCode?: string | null, history?: Array<{ role: string; text: string }>): Promise<GroundedAnswer> {
  const context = await buildAssistantContext(marketCode);
  const res = await callLlm({
    agent: "AssistantAgent",
    stage: "ASSISTANT",
    promptId: "assistant.grounded",
    schema: GroundedAnswerSchema,
    schemaName: "GroundedAnswer",
    maxTokens: 4000,
    vars: { market: context.marketFilter, question, context, historyBlock: historyBlock(history) },
  });
  return res.data;
}

/** Streaming — yields the markdown answer token-by-token, then a trailing `===DATA===` JSON block. */
export async function* streamAnswer(question: string, marketCode?: string | null, history?: Array<{ role: string; text: string }>): AsyncGenerator<string, void, unknown> {
  const context = await buildAssistantContext(marketCode);
  yield* callLlmStream({
    agent: "AssistantAgent",
    stage: "ASSISTANT",
    promptId: "assistant.stream",
    maxTokens: 3000,
    vars: { market: context.marketFilter, question, context, historyBlock: historyBlock(history) },
  });
}
