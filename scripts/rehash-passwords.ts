import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "sentinel-salt").digest("hex");
}

async function main() {
  const hash = hashPassword("sentinel");
  console.log("New SHA-256 hash:", hash.slice(0, 20) + "…");

  const local = new PrismaClient({ datasourceUrl: "file:/Users/abdul/Desktop/Sentinel/prisma/dev.db" });
  await local.user.updateMany({ data: { passwordHash: hash } });
  console.log("✓ Local SQLite updated");
  await local.$disconnect();

  const tursoUrl = "libsql://sentinel-iabdulwasey.aws-ap-south-1.turso.io";
  const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  const turso = new PrismaClient({ adapter });
  await turso.user.updateMany({ data: { passwordHash: hash } });
  console.log("✓ Turso updated");
  await turso.$disconnect();

  process.exit(0);
}
main();
