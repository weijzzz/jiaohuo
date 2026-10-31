/**
 * Column detection for imported tables.
 *
 * The exact headers Unide produces are not known yet, so nothing here is
 * hard-coded to one layout: headers are matched against the wording these
 * back-office exports tend to use, and whatever the guess gets wrong the user
 * can override in the import screen.
 */

export type Field =
  | 'codigo'
  | 'descripcion'
  | 'ean'
  | 'precio'
  | 'precioCoste'
  | 'iva'
  | 'unidadesPorCaja'
  | 'proveedor'
  | 'familia'

/** Lower-case, strip accents, and reduce punctuation to single spaces. */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Patterns per field, most specific first. Order across fields matters too:
 * "precio coste" must be tested before "precio", and "codigo de barras"
 * before "codigo", or the looser pattern swallows the column.
 */
const RULES: { field: Field; patterns: RegExp[] }[] = [
  {
    field: 'ean',
    patterns: [
      /^ean\b/,
      /\bean\b/,
      /\bgtin\b/,
      /\bbarras\b/,
      /\bcod(igo)? ?bar/,
      /\bbarcode\b/,
    ],
  },
  {
    field: 'precioCoste',
    patterns: [/\bcoste\b/, /\bcosto\b/, /precio (de )?compra/, /\bcompra\b/],
  },
  {
    field: 'precio',
    patterns: [/\bpvp\b/, /precio (de )?venta/, /^precio\b/, /\bprecio\b/, /\btarifa\b/],
  },
  { field: 'iva', patterns: [/\biva\b/, /\bimpuesto\b/, /\btipo iva\b/] },
  {
    field: 'unidadesPorCaja',
    patterns: [
      /(unidades|uds|ud|piezas|pzs) ?(x|por|\/)? ?caja/,
      /caja ?(x|por|\/)? ?(unidades|uds|ud)/,
      /\bembalaje\b/,
      /\bmultiplo\b/,
    ],
  },
  { field: 'proveedor', patterns: [/\bproveedor\b/, /\bsuministrador\b/, /\bfabricante\b/] },
  { field: 'familia', patterns: [/\bfamilia\b/, /\bseccion\b/, /\bcategoria\b/, /\bgrupo\b/] },
  {
    field: 'descripcion',
    patterns: [
      /\bdescripcion\b/,
      /\bdenominacion\b/,
      /\bdescription\b/,
      /^nombre\b/,
      /^articulo\b/,
      /\bnombre\b/,
    ],
  },
  {
    field: 'codigo',
    patterns: [
      /^codigo\b/,
      /^cod\b/,
      /\bcod(igo)? ?art/,
      /\breferencia\b/,
      /^ref\b/,
      /\bcodigo\b/,
      /\bsku\b/,
    ],
  },
]

/**
 * Guess which field each header holds.
 *
 * Several headers may map to `ean` — a unit barcode and a box barcode in
 * separate columns is the normal case. Every other field keeps its first
 * match, so a later lookalike column cannot displace it.
 */
export function guessMapping(headers: string[]): Record<string, Field> {
  const mapping: Record<string, Field> = {}
  const taken = new Set<Field>()
  const normalized = new Map(headers.map((header) => [header, normalizeHeader(header)]))

  for (const { field, patterns } of RULES) {
    // Patterns drive the search so that a column named "PVP" wins over one
    // named "Precio unitario" regardless of which comes first in the file.
    for (const pattern of patterns) {
      for (const header of headers) {
        if (header in mapping) continue
        if (taken.has(field) && field !== 'ean') continue
        if (!pattern.test(normalized.get(header)!)) continue
        mapping[header] = field
        taken.add(field)
      }
      if (taken.has(field) && field !== 'ean') break
    }
  }
  return mapping
}

/** Headers mapped to a given field, in their original order. */
export function headersFor(
  mapping: Record<string, Field>,
  field: Field,
  headers: string[],
): string[] {
  return headers.filter((header) => mapping[header] === field)
}
