import { describe, expect, it } from 'vitest'
import type { Articulo } from '../types'
import { foldText } from './text'
import { searchArticulos } from './search'

function articulo(codigo: string, descripcion: string, eans: string[] = []): Articulo {
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

const catalogo = [
  articulo('A100', 'Jamón Ibérico de bellota', ['5901234123457']),
  articulo('A200', 'Jamón serrano'),
  articulo('A300', 'Queso manchego'),
  articulo('B100', 'Aceite de oliva virgen extra'),
]

describe('searchArticulos', () => {
  it('puts an exact article code first', () => {
    expect(searchArticulos(catalogo, 'A100')[0].articulo.codigo).toBe('A100')
  })

  it('finds an article by barcode', () => {
    expect(searchArticulos(catalogo, '5901234123457')[0].articulo.codigo).toBe('A100')
  })

  it('ignores accents in both directions', () => {
    expect(searchArticulos(catalogo, 'jamon')).toHaveLength(2)
    expect(searchArticulos(catalogo, 'JAMÓN')).toHaveLength(2)
  })

  it('requires every term to be present', () => {
    const hits = searchArticulos(catalogo, 'jamon bellota')
    expect(hits).toHaveLength(1)
    expect(hits[0].articulo.codigo).toBe('A100')
  })

  it('ranks a code prefix above an incidental text match', () => {
    // 'a' is a prefix of A100/A200/A300 and also appears inside "Aceite".
    const hits = searchArticulos(catalogo, 'a')
    const codes = hits.map((hit) => hit.articulo.codigo)
    expect(codes.slice(0, 3).sort()).toEqual(['A100', 'A200', 'A300'])
    expect(codes.indexOf('B100')).toBeGreaterThan(codes.indexOf('A100'))
  })

  it('ranks an exact code above a description match for the same text', () => {
    const hits = searchArticulos(
      [articulo('QUESO', 'Otra cosa'), articulo('Z999', 'Queso manchego')],
      'queso',
    )
    expect(hits[0].articulo.codigo).toBe('QUESO')
  })

  it('returns nothing for an empty query', () => {
    expect(searchArticulos(catalogo, '   ')).toEqual([])
  })

  it('respects the limit', () => {
    expect(searchArticulos(catalogo, 'a', 2)).toHaveLength(2)
  })
})
