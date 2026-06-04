import type { StorageDriver } from "./types";
import { LocalFsDriver } from "./local-fs";
import { VercelBlobDriver } from "./vercel-blob";

let cached: StorageDriver | null = null;

/** Resolve the active storage driver from env (vercel-blob when a token is present). */
export function storage(): StorageDriver {
  if (cached) return cached;
  const explicit = process.env.STORAGE_DRIVER;
  const useBlob =
    explicit === "vercel-blob" ||
    (explicit !== "local-fs" && !!process.env.BLOB_READ_WRITE_TOKEN);
  cached = useBlob ? new VercelBlobDriver() : new LocalFsDriver();
  return cached;
}

/** Convenience: fetch a stored document's bytes as base64 (to feed Claude's native PDF/image input). */
export async function getDocumentBase64(ref: string): Promise<string> {
  const bytes = await storage().getBytes(ref);
  return bytes.toString("base64");
}

export type { StorageDriver, StoredObject } from "./types";
