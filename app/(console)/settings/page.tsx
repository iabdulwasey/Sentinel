import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getSettings, getAnthropicKey } from "@/lib/settings";
import { normalizeRoles } from "@/lib/rbac";
import { MODEL_BY_TIER, RATE_CARD } from "@/engine/llm/models";
import { CONFIDENCE_THRESHOLDS } from "@/lib/confidence";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [user, settings, keyStatus] = await Promise.all([getSessionUser(), getSettings(), getAnthropicKey()]);

  const [users, markets, partnerCount, requestCount, runCount, auditCount, spendAgg] = await Promise.all([
    db.user.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true, roles: true, isActive: true } }),
    db.market.findMany({ where: { deletedAt: null }, orderBy: { country: "asc" }, select: { code: true, country: true, activeRulesetVersion: true } }),
    db.fleetPartner.count({ where: { deletedAt: null } }),
    db.authorityRequest.count({ where: { deletedAt: null } }),
    db.pipelineRun.count(),
    db.auditLog.count(),
    db.aiCallLog.aggregate({ _sum: { costMicroUsd: true } }),
  ]);

  const datastore = process.env.TURSO_DATABASE_URL ? "turso" : "sqlite";
  const storage =
    process.env.STORAGE_DRIVER === "vercel-blob" || (process.env.STORAGE_DRIVER !== "local-fs" && process.env.BLOB_READ_WRITE_TOKEN) ? "vercel-blob" : "local-fs";

  const meta = {
    role: user?.role ?? "REVIEWER",
    permissions: user?.permissions ?? [],
    activeRole: user?.activeRole ?? "compliance_reviewer",
    keyStatus: { source: keyStatus.source, last4: keyStatus.last4 },
    defaultModels: MODEL_BY_TIER,
    rateCard: RATE_CARD,
    liveThresholds: CONFIDENCE_THRESHOLDS,
    datastore,
    storage,
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, roles: normalizeRoles(u.roles, u.role), isActive: u.isActive })),
    markets,
    counts: { partners: partnerCount, requests: requestCount, runs: runCount, audit: auditCount },
    spendUsd: (spendAgg._sum.costMicroUsd ?? 0) / 1_000_000,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Settings" description="Configure the AI engine, data connectors, approval governance, accuracy thresholds, team, and notifications. Changes are persisted and audit-logged." />
      <SettingsClient settings={settings} meta={meta} />
    </div>
  );
}
