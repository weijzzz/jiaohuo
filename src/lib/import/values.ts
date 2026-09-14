/**
 * Cell-level parsing for imported tables.
 *
 * Exports out of Spanish back-office software are written for Spanish Excel:
 * "1.234,56 €" is one thousand two hundred and thirty-four euros and fifty-six
 * cents, and reading it with `Number()` gives NaN or, worse, 1.234.
 */

/**
 * Parse a number written in either the Spanish or the English convention.
 *
 * When both separators appear, the rightmost one is the decimal point. A lone
 * dot followed by exactly three digits is a thousands separator, because
 * "1.500" in an es-ES export means 1500 rather than 1.5.
 */
export function parseNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null
  const cleaned = raw.replace(/[^\d.,-]/g, '').trim()
  if (!/\d/.test(cleaned)) return null

  const negative = cleaned.startsWith('-')
  const body = cleaned.replace(/-/g, '')
  const lastComma = body.lastIndexOf(',')
  const lastDot = body.lastIndexOf('.')

  let decimal: string | null = null
  if (lastComma >= 0 && lastDot >= 0) {
    decimal = lastComma > lastDot ? ',' : '.'
  } else if (lastComma >= 0) {
    decimal = ','
  } else if (lastDot >= 0) {
    decimal = body.length - lastDot - 1 === 3 ? null : '.'
  }

  let digitsOnly: string
  if (decimal === null) {
    digitsOnly = body.replace(/[.,]/g, '')
  } else {
    const split = body.lastIndexOf(decimal)
    const whole = body.slice(0, split).replace(/[.,]/g, '')
    const fraction = body.slice(split + 1).replace(/[.,]/g, '')
    digitsOnly = `${whole || '0'}.${fraction}`
  }

  const value = Number(digitsOnly)
  if (!Number.isFinite(value)) return null
  return negative ? -value : value
}

/** Parse a whole number, ignoring any decimal part. */
export function parseInteger(raw: string | undefined | null): number | null {
  const value = parseNumber(raw)
  if (value === null) return null
  return Math.trunc(value)
}

/**
 * Parse a VAT rate to a percentage. Exports write it either as "21", "21%" or
 * "0,21"; anything below 1 is read as a fraction.
 */
export function parseIva(raw: string | undefined | null): number | null {
  const value = parseNumber(raw)
  if (value === null) return null
  if (value > 0 && value < 1) return Math.round(value * 10000) / 100
  return value
}

const BOMS: { bom: number[]; encoding: string }[] = [
  { bom: [0xef, 0xbb, 0xbf], encoding: 'utf-8' },
  { bom: [0xff, 0xfe], encoding: 'utf-16le' },
  { bom: [0xfe, 0xff], encoding: 'utf-16be' },
]

/**
 * Decode an uploaded file, detecting the encoding.
 *
 * "Exportar a Excel" in this kind of software usually means windows-1252, so a
 * file that is not valid UTF-8 is decoded as that rather than rejected — the
 * alternative is a catalogue full of "Ni�o" and "12,50 �".
 */
export function decodeText(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer)

  for (const { bom, encoding } of BOMS) {
    if (bom.every((byte, index) => bytes[index] === byte)) {
      const text = new TextDecoder(encoding).decode(bytes.subarray(bom.length))
      return { text, encoding }
    }
  }

  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' }
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' }
  }
}
