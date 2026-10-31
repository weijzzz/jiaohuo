import type { Articulo } from '../types'
import { lookupKeys } from './ean'
import { searchArticulos, type SearchHit } from './search'

/**
 * The loaded snapshot, indexed for lookup.
 *
 * Built once per import or load, then queried synchronously — the scan loop
 * runs several times a second and must not await anything.
 */
export interface Catalog {
  articulos: Articulo[]
  byCodigo: Map<string, Articulo>
  byEan: Map<string, Articulo[]>
}

export const EMPTY_CATALOG: Catalog = {
  articulos: [],
  byCodigo: new Map(),
  byEan: new Map(),
}

export function buildCatalog(articulos: Articulo[]): Catalog {
  const byCodigo = new Map<string, Articulo>()
  const byEan = new Map<string, Articulo[]>()

  for (const articulo of articulos) {
    byCodigo.set(articulo.codigo, articulo)
    for (const ean of articulo.eans) {
      const existing = byEan.get(ean)
      if (existing) existing.push(articulo)
      else byEan.set(ean, [articulo])
    }
  }
  return { articulos, byCodigo, byEan }
}

export interface ScanMatch {
  articulos: Articulo[]
  /** The key that actually hit, which may not be the code that was scanned. */
  matchedKey: string
  /** True when the hit came from a derived code rather than the scanned one. */
  derived: boolean
}

/**
 * Resolve a scanned barcode.
 *
 * A scan can also hit through a derived code: scanning the box when the
 * snapshot only lists the unit, or the other way round. That is reported so
 * the UI can say so rather than quietly showing a different product's price.
 */
export function lookupByScan(catalog: Catalog, raw: string): ScanMatch | null {
  const keys = lookupKeys(raw)
  for (const [index, key] of keys.entries()) {
    const hit = catalog.byEan.get(key)
    if (hit?.length) {
      return { articulos: hit, matchedKey: key, derived: index > 0 }
    }
  }
  // Some shops label shelves with the article code rather than a barcode.
  const byCodigo = catalog.byCodigo.get(raw.trim())
  if (byCodigo) return { articulos: [byCodigo], matchedKey: raw.trim(), derived: false }
  return null
}

export function search(catalog: Catalog, query: string, limit?: number): SearchHit[] {
  return searchArticulos(catalog.articulos, query, limit)
}
