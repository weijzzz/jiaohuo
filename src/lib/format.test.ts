import { describe, expect, it } from 'vitest'
import { formatAge, formatPrice, freshness } from './format'

const HOUR = 60 * 60 * 1000

describe('formatPrice', () => {
  it('formats euros the Spanish way', () => {
    // Intl uses a narrow no-break space before the symbol.
    expect(formatPrice(1.25).replace(/\s/g, ' ')).toBe('1,25 €')
    expect(formatPrice(1234.5).replace(/\s/g, ' ')).toBe('1234,50 €')
  })

  it('shows a dash when there is no price', () => {
    expect(formatPrice(null)).toBe('—')
  })
})

describe('freshness', () => {
  const now = Date.UTC(2026, 0, 10, 12, 0, 0)

  it('treats today as fresh', () => {
    expect(freshness(now - 2 * HOUR, now)).toBe('fresh')
  })

  it('treats yesterday-but-one as aging', () => {
    expect(freshness(now - 30 * HOUR, now)).toBe('aging')
  })

  it('treats last week as stale', () => {
    expect(freshness(now - 8 * 24 * HOUR, now)).toBe('stale')
  })
})

describe('formatAge', () => {
  const now = Date.UTC(2026, 0, 10, 12, 0, 0)

  it('describes the age in the largest sensible unit', () => {
    expect(formatAge(now - 30000, now)).toBe('ahora mismo')
    expect(formatAge(now - 5 * 60000, now)).toBe('hace 5 min')
    expect(formatAge(now - 3 * HOUR, now)).toBe('hace 3 h')
    expect(formatAge(now - 26 * HOUR, now)).toBe('hace 1 día')
    expect(formatAge(now - 80 * HOUR, now)).toBe('hace 3 días')
  })
})
