import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * Single Prisma client for the whole app.
 *
 * - Local/dev: plain SQLite file via `DATABASE_URL` (file:./prisma/dev.db).
 * - Production: Turso (libSQL) via the driver adapter when `TURSO_DATABASE_URL`
 *   is set. The schema stays `provider = "sqlite"`; only the runtime driver changes.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

export const db: PrismaClient = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
