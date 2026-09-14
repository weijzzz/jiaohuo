/**
 * Display formatting, in es-ES throughout — the people using this read prices
 * in euros with a comma.
 */

const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })
const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' })

export function formatPrice(value: number | null): string {
  if (value === null) return '—'
  return currency.format(value)
}

export function formatNumber(value: number | null): string {
  if (value === null) return '—'
  return decimal.format(value)
}

export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${decimal.format(value)} %`
}

export function formatDateTime(timestamp: number): string {
  return dateTime.format(new Date(timestamp))
}

export type Freshness = 'fresh' | 'aging' | 'stale'

const HOUR = 60 * 60 * 1000

/**
 * How much to trust a snapshot's prices.
 *
 * The catalogue is a copy taken at a point in time, so the age of that copy is
 * the single most important thing on screen: a price that was right yesterday
 * is worth acting on, one from last week is worth checking.
 */
export function freshness(importedAt: number, now = Date.now()): Freshness {
  const age = now - importedAt
  if (age < 24 * HOUR) return 'fresh'
  if (age < 72 * HOUR) return 'aging'
  return 'stale'
}

/** Short, human age of a snapshot: "hace 3 h", "hace 2 días". */
export function formatAge(importedAt: number, now = Date.now()): string {
  const age = Math.max(0, now - importedAt)
  const minutes = Math.floor(age / 60000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'hace 1 día' : `hace ${days} días`
}
