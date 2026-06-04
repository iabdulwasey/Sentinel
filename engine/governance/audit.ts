import crypto from "crypto";
import { db } from "../../lib/db";

/**
 * Immutable, hash-chained audit log. Each entry's hash = sha256(prevHash + canonical(payload)),
 * so any tampering breaks the chain. Every meaningful action — AI call, constraint decision,
 * gate open/close, human decision, state change — is appended here.
 */
export interface AuditInput {
  actorType: "HUMAN" | "AI" | "SYSTEM";
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  aiModel?: string | null;
  promptVersion?: string | null;
  costMicroUsd?: number | null;
  confidence?: number | null;
  aiCallId?: string | null;
}

function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

export async function writeAudit(input: AuditInput) {
  const last = await db.auditLog.findFirst({ orderBy: { id: "desc" }, select: { hash: true } });
  const prevHash = last?.hash ?? null;
  const payload = canonical({
    actorType: input.actorType,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    aiCallId: input.aiCallId ?? null,
  });
  const hash = crypto.createHash("sha256").update((prevHash ?? "") + payload).digest("hex");

  return db.auditLog.create({
    data: {
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? undefined : (input.before as object),
      after: input.after === undefined ? undefined : (input.after as object),
      aiModel: input.aiModel ?? undefined,
      promptVersion: input.promptVersion ?? undefined,
      costMicroUsd: input.costMicroUsd ?? undefined,
      confidence: input.confidence ?? undefined,
      aiCallId: input.aiCallId ?? undefined,
      prevHash: prevHash ?? undefined,
      hash,
    },
  });
}

/** Verify the chain is intact (for the Audit view's integrity badge). */
export async function verifyAuditChain(): Promise<{ ok: boolean; brokenAt?: number }> {
  const rows = await db.auditLog.findMany({ orderBy: { id: "asc" } });
  let prev: string | null = null;
  for (const r of rows) {
    const payload = canonical({
      actorType: r.actorType,
      actorUserId: r.actorUserId ?? null,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      before: r.before ?? null,
      after: r.after ?? null,
      aiCallId: r.aiCallId ?? null,
    });
    const expected: string = crypto.createHash("sha256").update((prev ?? "") + payload).digest("hex");
    if (expected !== r.hash) return { ok: false, brokenAt: r.id };
    prev = r.hash;
  }
  return { ok: true };
}
