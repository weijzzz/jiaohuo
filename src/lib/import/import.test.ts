import { describe, expect, it } from 'vitest'
import { buildSnapshot, type ParsedTable } from './index'
import { guessMapping, normalizeHeader } from './mapping'

describe('normalizeHeader', () => {
  it('folds accents and punctuation', () => {
    expect(normalizeHeader('Descripción')).toBe('descripcion')
    expect(normalizeHeader('P.V.P. (€)')).toBe('p v p')
    expect(normalizeHeader('  Código Artículo ')).toBe('codigo articulo')
  })
})

describe('guessMapping', () => {
  it('maps the headers a Spanish back-office export tends to use', () => {
    const mapping = guessMapping([
      'Código',
      'Descripción',
      'EAN',
      'PVP',
      'Precio Coste',
      'IVA',
      'Uds/Caja',
      'Proveedor',
      'Familia',
    ])
    expect(mapping).toEqual({
      'Código': 'codigo',
      'Descripción': 'descripcion',
      EAN: 'ean',
      PVP: 'precio',
      'Precio Coste': 'precioCoste',
      IVA: 'iva',
      'Uds/Caja': 'unidadesPorCaja',
      Proveedor: 'proveedor',
      Familia: 'familia',
    })
  })

  it('does not let "Precio Coste" take the sale price column', () => {
    const mapping = guessMapping(['Precio Coste', 'Precio Venta'])
    expect(mapping['Precio Coste']).toBe('precioCoste')
    expect(mapping['Precio Venta']).toBe('precio')
  })

  it('does not let "Código de barras" take the article code column', () => {
    const mapping = guessMapping(['Código de barras', 'Código'])
    expect(mapping['Código de barras']).toBe('ean')
    expect(mapping['Código']).toBe('codigo')
  })

  it('maps every barcode column, not just the first', () => {
    const mapping = guessMapping(['Codigo', 'EAN Unidad', 'EAN Caja'])
    expect(mapping['EAN Unidad']).toBe('ean')
    expect(mapping['EAN Caja']).toBe('ean')
  })

  it('prefers the more specific header when two could match', () => {
    const mapping = guessMapping(['Precio unitario medio', 'PVP'])
    expect(mapping['PVP']).toBe('precio')
  })
})

function table(headers: string[], rows: Record<string, string>[]): ParsedTable {
  return { headers, rows, source: 'csv', label: 'test.csv', encoding: 'utf-8', delimiter: ';' }
}

describe('buildSnapshot', () => {
  const headers = ['Codigo', 'Descripcion', 'EAN Unidad', 'EAN Caja', 'PVP', 'Uds/Caja']

  it('collects the unit and the box barcode onto one article', () => {
    const input = table(headers, [
      {
        Codigo: 'A100',
        Descripcion: 'Leche entera 1L',
        'EAN Unidad': '5901234123457',
        'EAN Caja': '15901234123454',
        PVP: '1,25',
        'Uds/Caja': '6',
      },
    ])
    const { articulos, report } = buildSnapshot(input, guessMapping(headers))

    expect(articulos).toHaveLength(1)
    expect(articulos[0].eans).toEqual(['5901234123457', '15901234123454'])
    expect(articulos[0].precio).toBe(1.25)
    expect(articulos[0].unidadesPorCaja).toBe(6)
    expect(report.meta.eanCount).toBe(2)
  })

  it('repairs a barcode that lost its leading zero in Excel', () => {
    const input = table(headers, [
      { Codigo: 'A101', Descripcion: 'Atún', 'EAN Unidad': '36000291452', PVP: '2,10' },
    ])
    const { articulos, report } = buildSnapshot(input, guessMapping(headers))
    expect(articulos[0].eans).toEqual(['0036000291452'])
    expect(report.invalidEans).toHaveLength(0)
  })

  it('reports a barcode it cannot make sense of instead of dropping it', () => {
    const input = table(headers, [
      { Codigo: 'A102', Descripcion: 'Pan', 'EAN Unidad': '5901234123458', PVP: '0,90' },
    ])
    const { articulos, report } = buildSnapshot(input, guessMapping(headers))
    expect(articulos[0].eans).toEqual([])
    expect(report.invalidEans).toEqual([{ codigo: 'A102', value: '5901234123458' }])
  })

  it('splits several barcodes sharing one cell', () => {
    const input = table(headers, [
      {
        Codigo: 'A103',
        Descripcion: 'Agua',
        'EAN Unidad': '5901234123457 / 96385074',
        PVP: '0,40',
      },
    ])
    const { articulos } = buildSnapshot(input, guessMapping(headers))
    expect(articulos[0].eans).toEqual(['5901234123457', '96385074'])
  })

  it('skips rows with no article code and counts them', () => {
    const input = table(headers, [
      { Codigo: '', Descripcion: 'Total', PVP: '99,00' },
      { Codigo: 'A104', Descripcion: 'Café', PVP: '3,50' },
    ])
    const { articulos, report } = buildSnapshot(input, guessMapping(headers))
    expect(articulos).toHaveLength(1)
    expect(report.skipped).toBe(1)
  })

  it('keeps the last row when a code repeats, and reports it', () => {
    const input = table(headers, [
      { Codigo: 'A105', Descripcion: 'Viejo', PVP: '1,00' },
      { Codigo: 'A105', Descripcion: 'Nuevo', PVP: '2,00' },
    ])
    const { articulos, report } = buildSnapshot(input, guessMapping(headers))
    expect(articulos).toHaveLength(1)
    expect(articulos[0].precio).toBe(2)
    expect(report.duplicates).toEqual(['A105'])
  })

  it('folds accents into the search haystack', () => {
    const input = table(headers, [{ Codigo: 'A106', Descripcion: 'Jamón Ibérico', PVP: '30,00' }])
    const { articulos } = buildSnapshot(input, guessMapping(headers))
    expect(articulos[0].busqueda).toContain('jamon iberico')
  })

  it('keeps unmapped columns instead of discarding them', () => {
    const input = table([...headers, 'Stock'], [
      { Codigo: 'A107', Descripcion: 'Sal', PVP: '0,60', Stock: '42' },
    ])
    const { articulos } = buildSnapshot(input, guessMapping([...headers, 'Stock']))
    expect(articulos[0].extra).toEqual({ Stock: '42' })
  })
})
