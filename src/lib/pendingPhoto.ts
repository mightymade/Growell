/**
 * Keeps the photo chosen at sign-up on this device until the farmer first
 * logs in. Before the email is confirmed there is no session, and storage
 * only accepts uploads from a logged-in owner, so it can't upload yet.
 * IndexedDB holds the file itself (localStorage is too small for photos).
 * Everything here fails quietly: a missing photo must never block login.
 */
const DB = "growell";
const STORE = "pending-photo";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

const key = (email: string) => email.trim().toLowerCase();

export async function savePendingPhoto(email: string, file: File): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put({ file, name: file.name, type: file.type, savedAt: Date.now() }, key(email)));
    return true;
  } catch {
    return false;
  }
}

/** The photo waiting for this email, if any (kept for up to 30 days). */
export async function takePendingPhoto(email: string): Promise<File | null> {
  try {
    const row = (await run("readonly", (s) => s.get(key(email)))) as
      | { file: Blob; name: string; type: string; savedAt: number }
      | undefined;
    if (!row) return null;
    if (Date.now() - row.savedAt > 30 * 24 * 60 * 60 * 1000) {
      await clearPendingPhoto(email);
      return null;
    }
    return new File([row.file], row.name, { type: row.type });
  } catch {
    return null;
  }
}

export async function clearPendingPhoto(email: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(key(email)));
  } catch {
    // nothing to clear
  }
}
