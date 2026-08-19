/**
 * Tiny IndexedDB blob store for locally imported panorama images.
 * Panorama images are far too large for localStorage, so scenes store an
 * "idb:<key>" reference and the actual Blob lives here.
 */
const DB_NAME = "opentour-assets";
const STORE = "panoramas";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const IDB_PREFIX = "idb:";

export async function putBlob(key: string, blob: Blob) {
  await tx("readwrite", (s) => s.put(blob, key) as IDBRequest<IDBValidKey>);
  return IDB_PREFIX + key;
}

export async function getBlob(ref: string): Promise<Blob | null> {
  if (!ref.startsWith(IDB_PREFIX)) return null;
  const res = await tx<Blob | undefined>("readonly", (s) => s.get(ref.slice(IDB_PREFIX.length)));
  return res ?? null;
}

export async function deleteBlob(ref: string) {
  if (!ref.startsWith(IDB_PREFIX)) return;
  await tx("readwrite", (s) => s.delete(ref.slice(IDB_PREFIX.length)) as unknown as IDBRequest<undefined>);
}

const urlCache = new Map<string, string>();

/** Resolves a scene panoramaUrl into something an <img>/viewer can load. */
export async function resolveUrl(ref: string): Promise<string> {
  if (!ref) return "";
  if (!ref.startsWith(IDB_PREFIX)) return ref;
  const cached = urlCache.get(ref);
  if (cached) return cached;
  const blob = await getBlob(ref);
  if (!blob) return "";
  const url = URL.createObjectURL(blob);
  urlCache.set(ref, url);
  return url;
}