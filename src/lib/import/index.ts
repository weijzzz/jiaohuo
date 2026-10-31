import Papa from 'papaparse'
import type { Articulo, ImportReport, RawRow, SnapshotMeta, SnapshotSource } from '../../types'
import { normalizeGtin } from '../ean'
import { guessMapping, type Field } from './mapping'
import { foldText } from '../text'
import { decodeText, parseInteger, parseIva, parseNumber } from './values'

export * from './mapping'
export * from './values'

export interface ParsedTable {
  headers: string[]
  rows: RawRow[]
  source: SnapshotSource
  label: string
  encoding: string
  /** Delimiter Papa settled on, shown so a mis-parsed file is obvious. */
  delimiter: string
}

/** Search a decoded JSON payload for the first array of objects it contains. */
function findRows(value: unknown, depth = 0): RawRow[] | null {
  if (depth > 4) return null
  if (Array.isArray(value)) {
    return value.every((item) => item && typeof item === 'object' && !Array.isArray(item))
      ? (value as RawRow[])
      : null
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      const rows = findRows(nested, depth + 1)
      if (rows?.length) return rows
    }
  }
  return null
}

function stringifyCells(rows: RawRow[]): RawRow[] {
  return rows.map((row) => {
    const out: RawRow = {}
    for (const [key, value] of Object.entries(row)) {
      out[key] = value == null ? '' : String(value)
    }
    return out
  })
}

/**
 * Read an uploaded file into rows.
 *
 * CSV and JSON are both accepted because it is not yet settled how the data
 * will leave Unide: a downloaded export and a captured XHR response land here
 * the same way.
 */
export async function readTable(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer()
  const { text, encoding } = decodeText(buffer)
  const isJson = /\.json$/i.test(file.name) || text.trimStart().startsWith('{') || text.trimStart().startsWith('[')

  if (isJson) {
    const rows = findRows(JSON.parse(text))
    if (!rows?.length) {
      throw new Error('El archivo JSON no contiene ninguna lista de artículos.')
    }
    const stringified = stringifyCells(rows)
    const headers = [...new Set(stringified.flatMap((row) => Object.keys(row)))]
    return { headers, rows: stringified, source: 'json', label: file.name, encoding, delimiter: '' }
  }

  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    // Spanish exports normally use ';', because ',' is the decimal separator.
    delimitersToGuess: [';', ',', '\t', '|'],
    transformHeader: (header) => header.trim(),
  })

  const rows = stringifyCells(result.data)
  const headers = result.meta.fields?.map((field) => field.trim()) ?? []
  if (headers.length === 0) {
    throw new Error('No se ha podido leer ninguna cabecera del archivo CSV.')
  }
  return {
    headers,
    rows,
    source: 'csv',
    label: file.name,
    encoding,
    delimiter: result.meta.delimiter,
  }
}

function firstValue(row: RawRow, headers: string[]): string {
  for (const header of headers) {
    const value = row[header]?.trim()
    if (value) return value
  }
  return ''
}

/** Lower-case, accent-free haystack so "nino" also finds "Niño". */
function buildHaystack(parts: (string | null)[]): string {
  return foldText(parts.filter(Boolean).join(' '))
}

/**
 * Turn parsed rows into the article snapshot.
 *
 * Barcodes go through the repairing normaliser here — unlike a live scan, a
 * value in a spreadsheet has probably been through Excel. Anything that still
 * fails its check digit is reported rather than dropped in silence, since a
 * barcode column that is quietly empty looks exactly like an app that does not
 * work when someone scans a product.
 */
export function buildSnapshot(
  table: ParsedTable,
  mapping: Record<string, Field>,
): { articulos: Articulo[]; report: ImportReport } {
  const columns = (field: Field) => table.headers.filter((header) => mapping[header] === field)

  const codigoCols = columns('codigo')
  const descripcionCols = columns('descripcion')
  const eanCols = columns('ean')
  const precioCols = columns('precio')
  const costeCols = columns('precioCoste')
  const ivaCols = columns('iva')
  const cajaCols = columns('unidadesPorCaja')
  const proveedorCols = columns('proveedor')
  const familiaCols = columns('familia')
  const mappedCols = new Set(Object.keys(mapping))

  const byCodigo = new Map<string, Articulo>()
  const invalidEans: ImportReport['invalidEans'] = []
  const duplicates: string[] = []
  let skipped = 0

  for (const row of table.rows) {
    const codigo = firstValue(row, codigoCols)
    if (!codigo) {
      skipped++
      continue
    }

    const eans: string[] = []
    for (const header of eanCols) {
      const raw = row[header]?.trim()
      if (!raw) continue
      // One cell can hold several barcodes separated by punctuation.
      for (const candidate of raw.split(/[\s,;|/]+/).filter(Boolean)) {
        const normalized = normalizeGtin(candidate, { repair: true })
        if (normalized) {
          if (!eans.includes(normalized)) eans.push(normalized)
        } else {
          invalidEans.push({ codigo, value: candidate })
        }
      }
    }

    const descripcion = firstValue(row, descripcionCols)
    const proveedor = firstValue(row, proveedorCols) || null
    const familia = firstValue(row, familiaCols) || null

    const extra: Record<string, string> = {}
    for (const [header, value] of Object.entries(row)) {
      if (!mappedCols.has(header) && value?.trim()) extra[header] = value.trim()
    }

    const articulo: Articulo = {
      codigo,
      descripcion,
      eans,
      precio: parseNumber(firstValue(row, precioCols)),
      precioCoste: parseNumber(firstValue(row, costeCols)),
      iva: parseIva(firstValue(row, ivaCols)),
      unidadesPorCaja: parseInteger(firstValue(row, cajaCols)),
      proveedor,
      familia,
      busqueda: buildHaystack([codigo, descripcion, proveedor, familia, ...eans]),
      extra,
    }

    if (byCodigo.has(codigo)) duplicates.push(codigo)
    byCodigo.set(codigo, articulo)
  }

  const articulos = [...byCodigo.values()]
  const meta: SnapshotMeta = {
    importedAt: Date.now(),
    source: table.source,
    label: table.label,
    articleCount: articulos.length,
    eanCount: articulos.reduce((total, articulo) => total + articulo.eans.length, 0),
  }

  return {
    articulos,
    report: { meta, skipped, invalidEans, duplicates, mapping },
  }
}

/** Convenience path: read a file and map it with the guessed columns. */
export async function importFile(file: File) {
  const table = await readTable(file)
  const mapping = guessMapping(table.headers)
  return { table, mapping, ...buildSnapshot(table, mapping) }
}
