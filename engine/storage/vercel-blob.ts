import crypto from "crypto";
import { put, del } from "@vercel/blob";
import type { StorageDriver, StoredObject } from "./types";

/**
 * Production driver: stores bytes in Vercel Blob. The Blob URL is not derivable from
 * the key alone, so the stored ref IS the full public URL returned by put(); getUrl
 * returns it as-is and getBytes fetches it.
 */
export class VercelBlobDriver implements StorageDriver {
  async put(key: string, bytes: Buffer, contentType: string): Promise<StoredObject> {
    const res = await put(key, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      allowOverwrite: true,
    });
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    return { ref: res.url, url: res.url, size: bytes.length, sha256, contentType };
  }

  async getBytes(ref: string): Promise<Buffer> {
    const r = await fetch(ref);
    if (!r.ok) throw new Error(`Blob fetch failed (${r.status}) for ${ref}`);
    return Buffer.from(await r.arrayBuffer());
  }

  getUrl(ref: string): string {
    return ref;
  }

  async delete(ref: string): Promise<void> {
    await del(ref, { token: process.env.BLOB_READ_WRITE_TOKEN });
  }
}
