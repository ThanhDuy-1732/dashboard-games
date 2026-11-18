import { savedGameSchema } from "./save-schema.js";
import type { SavedGame } from "./save-schema.js";
export type SaveErrorCode =
  | "LEASE_LOST"
  | "INCOMPATIBLE"
  | "CORRUPT"
  | "SAVE_EXISTS";
export class SaveError extends Error {
  constructor(public code: SaveErrorCode) {
    super(code);
    this.name = "SaveError";
  }
}
export interface SaveStore {
  load(): Promise<{ save: SavedGame | null; recovered: boolean }>;
  save(save: SavedGame): Promise<void>;
  replace(save: SavedGame): Promise<void>;
  remove(): Promise<void>;
  claim(): Promise<boolean>;
  release(): Promise<void>;
}
interface Lease {
  owner: string;
  expires: number;
}
const LEASE_MS = 15000;
function incompatible(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    (("schemaVersion" in value && value.schemaVersion !== 1) ||
      ("rulesVersion" in value && value.rulesVersion !== "classic-v1"))
  );
}
function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}
export function createSaveStore(name = "nha-choi"): SaveStore {
  const owner = crypto.randomUUID();
  let opening: Promise<IDBDatabase> | undefined;
  function open() {
    return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const call = indexedDB.open(name, 1);
      call.onupgradeneeded = () => call.result.createObjectStore("offline");
      call.onsuccess = () => resolve(call.result);
      call.onerror = () => reject(call.error);
      call.onblocked = () => reject(new Error("Storage upgrade blocked"));
    }));
  }
  async function transaction<T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const db = await open();
    const tx = db.transaction("offline", mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(tx.error ?? new Error("Storage transaction aborted"));
      tx.onerror = () => reject(tx.error);
    });
    try {
      const value = await work(tx.objectStore("offline"));
      await done;
      return value;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* Transaction may already have aborted. */
      }
      await done.catch(() => {});
      throw error;
    }
  }
  function canWrite(lease: Lease | undefined) {
    if (
      !lease ||
      typeof lease.owner !== "string" ||
      !lease.owner.length ||
      !Number.isFinite(lease.expires)
    )
      return true;
    return lease.owner === owner || lease.expires <= Date.now();
  }
  async function write(input: SavedGame, replace: boolean) {
    const save = structuredClone(savedGameSchema.parse(input));
    await transaction("readwrite", async (store) => {
      const [lease, current] = await Promise.all([
        request(store.get("lease")) as Promise<Lease | undefined>,
        request(store.get("current")) as Promise<unknown>,
      ]);
      if (!canWrite(lease)) throw new SaveError("LEASE_LOST");
      if (!replace && incompatible(current))
        throw new SaveError("INCOMPATIBLE");
      const existing = savedGameSchema.safeParse(current);
      if (!replace && existing.success && existing.data.gameId !== save.gameId)
        throw new SaveError("SAVE_EXISTS");
      store.put({ owner, expires: Date.now() + LEASE_MS }, "lease");
      if (
        !replace &&
        existing.success &&
        existing.data.revision >= save.revision
      )
        return;
      if (current !== undefined && existing.success)
        store.put(current, "previous");
      else if (replace && current !== undefined) store.put(current, "previous");
      store.put(save, "current");
    });
  }
  return {
    load() {
      return transaction("readonly", async (store) => {
        const [current, previous] = await Promise.all([
          request(store.get("current")),
          request(store.get("previous")),
        ]);
        if (current === undefined && previous === undefined)
          return { save: null, recovered: false };
        if (incompatible(current)) throw new SaveError("INCOMPATIBLE");
        const latest = savedGameSchema.safeParse(current);
        if (latest.success) return { save: latest.data, recovered: false };
        const backup = savedGameSchema.safeParse(previous);
        if (backup.success) return { save: backup.data, recovered: true };
        throw new SaveError("CORRUPT");
      });
    },
    save(save) {
      return write(save, false);
    },
    replace(save) {
      return write(save, true);
    },
    claim() {
      return transaction("readwrite", async (store) => {
        const lease = (await request(store.get("lease"))) as Lease | undefined;
        if (!canWrite(lease)) return false;
        store.put({ owner, expires: Date.now() + LEASE_MS }, "lease");
        return true;
      });
    },
    release() {
      return transaction("readwrite", async (store) => {
        const lease = (await request(store.get("lease"))) as Lease | undefined;
        if (lease?.owner === owner) store.delete("lease");
      });
    },
    remove() {
      return transaction("readwrite", async (store) => {
        const lease = (await request(store.get("lease"))) as Lease | undefined;
        if (!canWrite(lease)) throw new SaveError("LEASE_LOST");
        store.delete("current");
        store.delete("previous");
      });
    },
  };
}
