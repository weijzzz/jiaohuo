/**
 * Accent-insensitive text folding.
 *
 * Staff type "nino" and "jamon" on a phone keyboard; the catalogue says "Niño"
 * and "Jamón". Both sides of every text comparison go through this.
 */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Split a query into the terms that must all be present. */
export function queryTerms(query: string): string[] {
  return foldText(query)
    .split(/\s+/)
    .filter(Boolean)
}
