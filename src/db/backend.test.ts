import { describe, expect, it } from 'vitest';

describe('storage backend', () => {
  it('falls back to an in-memory store when IndexedDB is unavailable', async () => {
    const original = globalThis.indexedDB;
    const { default: Dexie } = await import('dexie');
    const deps = { ...Dexie.dependencies };
    // @ts-expect-error simulate a browser without IndexedDB
    delete globalThis.indexedDB;
    try {
      const { initStorage, storageMode } = await import('./backend');
      expect(await initStorage()).toBe('memory');
      expect(storageMode()).toBe('memory');
      const { RumboDB } = await import('./db');
      const db = new RumboDB('rumbo-memory-test');
      await db.settings.put({ key: 'k', value: 1 });
      expect((await db.settings.get('k'))?.value).toBe(1);
      // Live queries (used by every screen) must emit in memory mode as well.
      const { liveQuery } = await import('dexie');
      const value = await new Promise((resolve) => {
        const sub = liveQuery(() => db.settings.get('k')).subscribe({
          next: (v) => {
            resolve(v?.value);
            sub.unsubscribe();
          },
        });
      });
      expect(value).toBe(1);
      db.close();
    } finally {
      globalThis.indexedDB = original;
      Object.assign(Dexie.dependencies, deps);
    }
  });
});
