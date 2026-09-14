/**
 * Domain types for the article snapshot.
 *
 * The snapshot is intentionally source-agnostic: whatever Unide turns out to
 * expose (CSV export, XHR JSON, pasted table) is normalised into `Articulo`
 * before it reaches the database, the search or the UI.
 */

/** Where a given snapshot came from, for display and for debugging imports. */
export type SnapshotSource = 'csv' | 'json' | 'manual'

export interface Articulo {
  /** Unide article code. Primary key — stable across price changes. */
  codigo: string
  descripcion: string
  /**
   * Every barcode that resolves to this article, normalised to EAN-13 where
   * possible. A single article commonly has one code for the `unidad` and
   * another for the `caja`, so this is always a list.
   */
  eans: string[]
  /** Sale price, in euros. `null` when the source had no usable value. */
  precio: number | null
  /** Cost/purchase price when the export carries one. */
  precioCoste: number | null
  iva: number | null
  /** Units per box, when known — the usual reason a second EAN exists. */
  unidadesPorCaja: number | null
  proveedor: string | null
  familia: string | null
  /** Lower-cased, accent-stripped haystack used by the text search. */
  busqueda: string
  /** Anything the source had that we did not map, kept for inspection. */
  extra: Record<string, string>
}

export interface SnapshotMeta {
  importedAt: number
  source: SnapshotSource
  /** Original file name or endpoint, shown so staff can spot a stale import. */
  label: string
  articleCount: number
  eanCount: number
}

/** A single parsed row before normalisation: raw header -> raw cell. */
export type RawRow = Record<string, string>

export interface ImportReport {
  meta: SnapshotMeta
  /** Rows skipped because they had no usable `codigo`. */
  skipped: number
  /** Rows whose barcode failed checksum validation, with the offending value. */
  invalidEans: { codigo: string; value: string }[]
  /** Codes that appeared more than once; later rows win. */
  duplicates: string[]
  /** Header -> Articulo field, as resolved for this import. */
  mapping: Record<string, string>
}
