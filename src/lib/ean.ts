/**
 * Barcode normalisation.
 *
 * Two different things feed this module and they fail in different ways:
 *
 *  - The *scanner* hands us exactly the digits that were on the label. Those
 *    are trustworthy, so we validate strictly and never guess.
 *  - The *import* hands us whatever survived a trip through Excel, which eats
 *    leading zeros ("0841234567890" -> "841234567890") and rewrites long
 *    numbers as "8.41234E+12". Those need repairing before they mean anything.
 *
 * Everything is reduced to a GTIN string of 8, 13 or 14 digits.
 */

export type GtinLength = 8 | 12 | 13 | 14

const SCIENTIFIC = /^(\d)(?:[.,](\d+))?[eE]\+?(\d+)$/

/**
 * Undo Excel's scientific-notation rendering of a long barcode.
 * "8.41234E+12" -> "8412340000000". Returns null when `value` is not in that
 * form. The trailing zeros are real information loss; the caller decides
 * whether a checksum-repaired guess is acceptable.
 */
export function expandScientific(value: string): string | null {
  const m = SCIENTIFIC.exec(value.trim())
  if (!m) return null
  const [, lead, frac = '', expRaw] = m
  const exp = Number(expRaw)
  if (exp > 20) return null
  const digits = lead + frac
  if (digits.length > exp + 1) return null
  return digits.padEnd(exp + 1, '0')
}

/** Strip formatting (spaces, dashes, NBSP) and expand scientific notation. */
export function toDigits(value: string): string {
  const trimmed = value.trim()
  const expanded = expandScientific(trimmed)
  return (expanded ?? trimmed).replace(/\D+/g, '')
}

/**
 * GS1 mod-10 check digit for a body without its check digit.
 * Weights alternate 3/1 from the rightmost body digit, which is what EAN-8,
 * UPC-A, EAN-13 and ITF-14 all use.
 */
export function checkDigit(body: string): number {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const weight = (body.length - 1 - i) % 2 === 0 ? 3 : 1
    sum += Number(body[i]) * weight
  }
  return (10 - (sum % 10)) % 10
}

/** True when `code` is all digits, a valid GTIN length, and the check digit agrees. */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code)) return false
  if (code.length !== 8 && code.length !== 12 && code.length !== 13 && code.length !== 14) {
    return false
  }
  return checkDigit(code.slice(0, -1)) === Number(code[code.length - 1])
}

/**
 * Canonical storage form: UPC-A is widened to EAN-13, and a 14-digit code
 * whose packaging indicator is 0 is just a padded EAN-13. A 14-digit code with
 * a non-zero indicator is a genuinely different GTIN (the case, not the unit)
 * and is left alone.
 */
export function canonicalGtin(code: string): string {
  if (code.length === 12) return '0' + code
  if (code.length === 14 && code[0] === '0') return code.slice(1)
  return code
}

/**
 * Rebuild a GTIN that lost leading zeros, by re-padding to each valid length
 * and keeping the padding that satisfies the check digit.
 *
 * This guesses, so it is only used on imported files. A wrong guess is
 * possible (roughly 1 in 10 per candidate length), which is why the import
 * reports every repaired value instead of applying them silently.
 */
export function repairTruncated(digits: string): string | null {
  // Excel drops the zeros a barcode happens to start with, which is at most a
  // handful. Padding a short string all the way up to 13 would "validate" one
  // time in ten by luck, so anything further away than MAX_LOST is not a
  // damaged barcode and is left alone.
  const MAX_LOST = 3
  const MIN_INPUT = 6
  if (digits.length < MIN_INPUT) return null

  for (const length of [13, 14, 8] as const) {
    if (digits.length >= length) continue
    if (length - digits.length > MAX_LOST) continue
    const padded = digits.padStart(length, '0')
    if (isValidGtin(padded)) return canonicalGtin(padded)
  }
  return null
}

export interface NormalizeOptions {
  /** Allow leading-zero repair. Use for file imports, never for live scans. */
  repair?: boolean
}

/**
 * Normalise one barcode to its canonical GTIN, or return null when the value
 * cannot be trusted as a barcode at all.
 */
export function normalizeGtin(value: string, options: NormalizeOptions = {}): string | null {
  const digits = toDigits(value)
  if (digits.length === 0) return null

  if (isValidGtin(digits)) return canonicalGtin(digits)

  if (options.repair) {
    const repaired = repairTruncated(digits)
    if (repaired) return repaired
  }
  return null
}

/**
 * Derive the unit EAN-13 hidden inside an ITF-14 case code: drop the packaging
 * indicator, drop the old check digit, and recompute. Returns null when `code`
 * is not a case code.
 */
export function unitGtinFromCase(code: string): string | null {
  if (code.length !== 14 || code[0] === '0') return null
  const body = code.slice(1, 13)
  return body + checkDigit(body)
}

/** The 14-digit case form of a unit EAN-13, with the given packaging indicator. */
export function caseGtinFromUnit(code: string, indicator: number): string | null {
  if (code.length !== 13 || indicator < 1 || indicator > 8) return null
  const body = String(indicator) + code.slice(0, 12)
  return body + checkDigit(body)
}

/**
 * Every key worth trying for one scanned barcode, best match first.
 *
 * A snapshot often carries only unit EANs even though staff scan the box, so
 * scanning a case code also looks up the unit inside it — and vice versa,
 * since a snapshot that lists only case codes is just as likely.
 */
export function lookupKeys(value: string): string[] {
  const digits = toDigits(value)
  if (digits.length === 0) return []

  const keys: string[] = []
  const push = (key: string | null) => {
    if (key && !keys.includes(key)) keys.push(key)
  }

  if (isValidGtin(digits)) {
    const canonical = canonicalGtin(digits)
    push(canonical)
    push(unitGtinFromCase(canonical))
    if (canonical.length === 13) {
      for (let indicator = 1; indicator <= 8; indicator++) {
        push(caseGtinFromUnit(canonical, indicator))
      }
    }
  } else {
    // Not a valid barcode — treat it as something typed by hand.
    push(digits)
  }
  return keys
}

/** Format a GTIN for display, grouped the way it reads off a label. */
export function formatGtin(code: string): string {
  if (code.length === 13) return `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`
  if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`
  if (code.length === 14) return `${code[0]} ${code.slice(1, 8)} ${code.slice(8)}`
  return code
}
