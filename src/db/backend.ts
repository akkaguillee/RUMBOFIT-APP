/**
 * Storage backend for Dexie.
 *
 * RUMBO stores everything in the browser's IndexedDB. Some contexts block it
 * (private windows, embedded viewers, file previews). In that case the app
 * falls back to an in-memory IndexedDB so it stays fully usable, and the UI
 * tells the user clearly that nothing will be kept after closing.
 *
 * Dexie receives stable proxy objects at construction time; they delegate to
 * whichever backend `initStorage()` selects before the first query.
 */

import Dexie from 'dexie';

export type StorageMode = 'persistent' | 'memory';

let override: { factory: IDBFactory; keyRange: typeof IDBKeyRange } | null = null;
let mode: StorageMode = 'persistent';
/** Why the temporary store is in use: storage blocked by the browser, or the saved database failed to open. */
export type MemoryReason = 'blocked' | 'open-failed';
let reason: MemoryReason = 'blocked';

const factory = (): IDBFactory => {
  const f = override?.factory ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!f) throw new Error('IndexedDB no está disponible.');
  return f;
};

const keyRange = (): typeof IDBKeyRange => {
  const k = override?.keyRange ?? (globalThis as { IDBKeyRange?: typeof IDBKeyRange }).IDBKeyRange;
  if (!k) throw new Error('IDBKeyRange no está disponible.');
  return k;
};

export const idbFactoryProxy = {
  open: (name: string, version?: number) => factory().open(name, version),
  deleteDatabase: (name: string) => factory().deleteDatabase(name),
  cmp: (a: unknown, b: unknown) => factory().cmp(a, b),
  databases: () => (typeof factory().databases === 'function' ? factory().databases() : Promise.resolve([])),
} as IDBFactory;

export const keyRangeProxy = {
  bound: (...a: Parameters<typeof IDBKeyRange.bound>) => keyRange().bound(...a),
  only: (v: unknown) => keyRange().only(v),
  lowerBound: (...a: Parameters<typeof IDBKeyRange.lowerBound>) => keyRange().lowerBound(...a),
  upperBound: (...a: Parameters<typeof IDBKeyRange.upperBound>) => keyRange().upperBound(...a),
} as unknown as typeof IDBKeyRange;

/**
 * Opens and deletes a throwaway database to check that IndexedDB really works
 * here. Errors fall back at once; a slow but working store gets a generous cap
 * so it is not mistaken for a blocked one.
 */
function probe(timeoutMs = 10_000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    try {
      const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
      if (!idb) return done(false);
      const name = '__rumbo_probe__';
      const timer = setTimeout(() => done(false), timeoutMs);
      const req = idb.open(name);
      req.onsuccess = () => {
        clearTimeout(timer);
        try {
          req.result.close();
          idb.deleteDatabase(name);
        } catch {
          /* best effort */
        }
        done(true);
      };
      req.onerror = () => {
        clearTimeout(timer);
        done(false);
      };
      req.onblocked = () => {
        clearTimeout(timer);
        done(false);
      };
    } catch {
      done(false);
    }
  });
}

export async function initStorage(): Promise<StorageMode> {
  if (await probe()) {
    mode = 'persistent';
    return mode;
  }
  return switchToMemory('blocked');
}

/** Routes every database call to the temporary in-memory store. */
export async function switchToMemory(why: MemoryReason): Promise<StorageMode> {
  reason = why;
  const fake = await import('fake-indexeddb');
  override = { factory: fake.indexedDB, keyRange: fake.IDBKeyRange };
  // Dexie's liveQuery() stays idle unless its global dependencies point to a
  // working IndexedDB, so register the in-memory implementation there too.
  Dexie.dependencies.indexedDB = fake.indexedDB;
  Dexie.dependencies.IDBKeyRange = fake.IDBKeyRange;
  mode = 'memory';
  return mode;
}

export function storageMode(): StorageMode {
  return mode;
}

export function memoryReason(): MemoryReason {
  return reason;
}
