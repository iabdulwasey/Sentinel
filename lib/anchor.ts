import { db } from "./db";

/** The platform "as-of" date — synthetic data is anchored to it so expiries stay live. */
export async function getAsOf(): Promise<Date> {
  const meta = await db.appMeta.findUnique({ where: { key: "seedAnchor" } });
  const v = meta?.value as { date?: string } | null;
  return v?.date ? new Date(v.date) : new Date();
}

export async function resolveMarketId(code?: string | null): Promise<string | undefined> {
  if (!code) return undefined;
  const m = await db.market.findUnique({ where: { code }, select: { id: true } });
  return m?.id;
}
