/**
 * Document storage abstraction. Synthetic PDFs/images are generated at seed time
 * and stored via a driver so the rest of the app never cares whether bytes live on
 * the local filesystem (dev) or in Vercel Blob (prod). `ref` is what we persist on
 * `Document.storageRef`; pass it back to read bytes or resolve a browser URL.
 */
export interface StoredObject {
  ref: string;
  url: string;
  size: number;
  sha256: string;
  contentType: string;
}

export interface StorageDriver {
  /** Store bytes under `key` (e.g. "documents/<uuid>.pdf"). Returns the persisted ref + a URL. */
  put(key: string, bytes: Buffer, contentType: string): Promise<StoredObject>;
  /** Read raw bytes for a stored ref (used to feed Claude base64 + stream to the browser). */
  getBytes(ref: string): Promise<Buffer>;
  /** Resolve a browser-loadable URL for a stored ref. */
  getUrl(ref: string): string;
  delete(ref: string): Promise<void>;
}
