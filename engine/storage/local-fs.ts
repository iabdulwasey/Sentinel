import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { StorageDriver, StoredObject } from "./types";

/**
 * Dev driver: writes under STORAGE_ROOT (default ./storage). The stored ref is the
 * relative key; bytes are served to the browser through the /api/documents/[...path]
 * route. Not used on Vercel (read-only FS) — see VercelBlobDriver.
 */
const ROOT = process.env.STORAGE_ROOT
  ? path.resolve(process.cwd(), process.env.STORAGE_ROOT)
  : path.join(process.cwd(), "storage");

export class LocalFsDriver implements StorageDriver {
  async put(key: string, bytes: Buffer, contentType: string): Promise<StoredObject> {
    const full = path.join(ROOT, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    return { ref: key, url: `/api/documents/${key}`, size: bytes.length, sha256, contentType };
  }

  async getBytes(ref: string): Promise<Buffer> {
    return fs.readFile(path.join(ROOT, ref));
  }

  getUrl(ref: string): string {
    return `/api/documents/${ref}`;
  }

  async delete(ref: string): Promise<void> {
    await fs.rm(path.join(ROOT, ref), { force: true });
  }
}
