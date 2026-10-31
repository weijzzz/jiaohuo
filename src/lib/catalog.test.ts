import { describe, expect, it } from 'vitest'
import type { Articulo } from '../types'
import { buildCatalog, lookupByScan } from './catalog'
import { foldText } from './text'

function articulo(codigo: string, descripcion: string, eans: string[]): Articulo {
  return {
    codigo,
    descripcion,
    eans,
    precio: 1,
    precioCoste: null,
    iva: 21,
    unidadesPorCaja: null,
    proveedor: null,
    familia: null,
    busqueda: foldText([codigo, descripcion, ...eans].join(' ')),
    extra: {},
  }
}

const UNIT = '5901234123457'
const CASE = '15901234123454'

describe('lookupByScan', () => {
  it('finds an article by the exact barcode that was scanned', () => {
    const catalog = buildCatalog([articulo('A1', 'Leche', [UNIT])])
    const match = lookupByScan(catalog, UNIT)
    expect(match?.articulos[0].codigo).toBe('A1')
    expect(match?.derived).toBe(false)
  })

  it('finds the unit when the box is scanned but only the unit is listed', () => {
    const catalog = buildCatalog([articulo('A1', 'Leche', [UNIT])])
    const match = lookupByScan(catalog, CASE)
    expect(match?.articulos[0].codigo).toBe('A1')
    expect(match?.matchedKey).toBe(UNIT)
    expect(match?.derived).toBe(true)
  })

  it('finds the box when the unit is scanned but only the box is listed', () => {
    const catalog = buildCatalog([articulo('A1', 'Leche caja', [CASE])])
    const match = lookupByScan(catalog, UNIT)
    expect(match?.articulos[0].codigo).toBe('A1')
    expect(match?.derived).toBe(true)
  })

  it('prefers the exact code over a derived one', () => {
    const catalog = buildCatalog([
      articulo('CAJA', 'Caja de leche', [CASE]),
      articulo('UNIDAD', 'Leche 1L', [UNIT]),
    ])
    const match = lookupByScan(catalog, CASE)
    expect(match?.articulos[0].codigo).toBe('CAJA')
    expect(match?.derived).toBe(false)
  })

  it('returns every article sharing a barcode', () => {
    const catalog = buildCatalog([
      articulo('A1', 'Leche', [UNIT]),
      articulo('A2', 'Leche duplicada', [UNIT]),
    ])
    expect(lookupByScan(catalog, UNIT)?.articulos).toHaveLength(2)
  })

  it('falls back to the article code for shelf labels', () => {
    const catalog = buildCatalog([articulo('A1', 'Leche', [UNIT])])
    expect(lookupByScan(catalog, 'A1')?.articulos[0].codigo).toBe('A1')
  })

  it('returns null when nothing matches', () => {
    const catalog = buildCatalog([articulo('A1', 'Leche', [UNIT])])
    expect(lookupByScan(catalog, '96385074')).toBeNull()
  })
})
