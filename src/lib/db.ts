import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Articulo, SnapshotMeta } from '../types'

/**
 * Persistence for the article snapshot.
 *
 * This layer only stores and loads. Lookups are served from the in-memory
 * catalogue (see `catalog.ts`) because the snapshot is one shop's article
 * list, which fits in memory comfortably, and because the scan loop cannot
 * afford to await a transaction several times a second.
 */

const DB_NAME = 'jiaohuo'
const DB_VERSION = 1
const META_KEY = 'snapshot'

interface JiaohuoDB extends DBSchema {
  articulos: { key: string; value: Articulo }
  meta: { key: string; value: SnapshotMeta }
}

let dbPromise: Promise<IDBPDatabase<JiaohuoDB>> | null = null

export function openDatabase(): Promise<IDBPDatabase<JiaohuoDB>> {
  dbPromise ??= openDB<JiaohuoDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('articulos', { keyPath: 'codigo' })
      db.createObjectStore('meta')
    },
  })
  return dbPromise
}

/**
 * Swap in a freshly imported snapshot, all or nothing.
 *
 * Prices are the point of the app, so a half-applied import would be worse
 * than no import: the old rows are cleared and the new ones written inside a
 * single transaction.
 */
export async function replaceSnapshot(
  articulos: Articulo[],
  meta: SnapshotMeta,
): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(['articulos', 'meta'], 'readwrite')
  const store = tx.objectStore('articulos')
  await store.clear()
  for (const articulo of articulos) {
    void store.put(articulo)
  }
  void tx.objectStore('meta').put(meta, META_KEY)
  await tx.done
}

export async function loadSnapshot(): Promise<{
  articulos: Articulo[]
  meta: SnapshotMeta | null
}> {
  const db = await openDatabase()
  const [articulos, meta] = await Promise.all([db.getAll('articulos'), db.get('meta', META_KEY)])
  return { articulos, meta: meta ?? null }
}

export async function clearSnapshot(): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(['articulos', 'meta'], 'readwrite')
  await tx.objectStore('articulos').clear()
  await tx.objectStore('meta').clear()
  await tx.done
}
