/**
 * Uploads all PDFs from ./storage/ to Vercel Blob and updates
 * the storageRef in Turso for every document row.
 *
 *   npx tsx scripts/upload-pdfs-to-blob.ts
 */
import { put } from "@vercel/blob";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSQL({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

const STORAGE_ROOT = path.resolve("./storage");

async function main() {
  const docs = await db.document.findMany({
    where: { mimeType: "application/pdf" },
    select: { id: true, storageRef: true },
  });

  console.log(`Uploading ${docs.length} PDFs to Vercel Blob…`);
  let ok = 0, skipped = 0, failed = 0;

  for (const doc of docs) {
    // Already a Blob URL — skip
    if (doc.storageRef.startsWith("https://")) {
      skipped++;
      continue;
    }

    const localPath = path.join(STORAGE_ROOT, doc.storageRef);
    if (!fs.existsSync(localPath)) {
      console.error(`  ✗ missing: ${doc.storageRef}`);
      failed++;
      continue;
    }

    try {
      const bytes = fs.readFileSync(localPath);
      const blob = await put(doc.storageRef, bytes, {
        access: "public",
        contentType: "application/pdf",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      await db.document.update({
        where: { id: doc.id },
        data: { storageRef: blob.url },
      });

      ok++;
      process.stdout.write(`\r  uploaded: ${ok}/${docs.length - skipped}`);
    } catch (e) {
      console.error(`\n  ✗ ${doc.storageRef}: ${e instanceof Error ? e.message : e}`);
      failed++;
    }
  }

  console.log(`\n\n✓ Done. uploaded:${ok} skipped:${skipped} failed:${failed}`);
  await db.$disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
