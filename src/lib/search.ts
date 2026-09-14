import type { Articulo } from '../types'
import { foldText, queryTerms } from './text'

/**
 * Text search over the loaded snapshot.
 *
 * The catalogue is small enough to hold in memory, so this runs over an array
 * rather than the database: someone typing into the box expects the list to
 * move as they type, and a cursor per keystroke does not.
 */

export interface SearchHit {
  articulo: Articulo
  score: number
}

const EXACT_CODIGO = 1000
const EXACT_EAN = 900
const PREFIX_CODIGO = 500
const PREFIX_DESCRIPCION = 300
const CONTAINS_ALL = 100

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function scoreArticulo(
  articulo: Articulo,
  folded: string,
  terms: string[],
  wordStarts: RegExp[],
): number {
  const codigo = foldText(articulo.codigo)
  if (codigo === folded) return EXACT_CODIGO
  if (articulo.eans.includes(folded)) return EXACT_EAN
  if (codigo.startsWith(folded)) return PREFIX_CODIGO

  const descripcion = foldText(articulo.descripcion)
  if (descripcion.startsWith(folded)) return PREFIX_DESCRIPCION

  // Every term has to appear somewhere, so "jamon iberico" does not match an
  // article that only mentions jamón.
  if (!terms.every((term) => articulo.busqueda.includes(term))) return 0

  // Terms that start a word are a better match than terms found mid-word.
  const wordMatches = wordStarts.filter((pattern) => pattern.test(articulo.busqueda)).length
  return CONTAINS_ALL + wordMatches
}

export function searchArticulos(articulos: Articulo[], query: string, limit = 50): SearchHit[] {
  const folded = foldText(query)
  if (!folded) return []

  const terms = queryTerms(query)
  // Compiled once per query. Building these inside the loop would mean one
  // regex per term per article on every keystroke.
  const wordStarts = terms.map((term) => new RegExp(`\\b${escapeRegExp(term)}`))

  const hits: SearchHit[] = []
  for (const articulo of articulos) {
    const score = scoreArticulo(articulo, folded, terms, wordStarts)
    if (score > 0) hits.push({ articulo, score })
  }

  hits.sort(
    (a, b) =>
      b.score - a.score || a.articulo.descripcion.localeCompare(b.articulo.descripcion, 'es'),
  )
  return hits.slice(0, limit)
}
