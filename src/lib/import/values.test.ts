import { describe, expect, it } from 'vitest'
import { parseInteger, parseIva, parseNumber } from './values'

describe('parseNumber', () => {
  it('reads the Spanish convention', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56)
    expect(parseNumber('12,50')).toBe(12.5)
    expect(parseNumber('1.234.567,89')).toBe(1234567.89)
  })

  it('reads the English convention', () => {
    expect(parseNumber('1,234.56')).toBe(1234.56)
    expect(parseNumber('12.50')).toBe(12.5)
  })

  it('treats a lone dot before three digits as a thousands separator', () => {
    expect(parseNumber('1.500')).toBe(1500)
    expect(parseNumber('1.234.567')).toBe(1234567)
  })

  it('strips currency symbols and whitespace', () => {
    expect(parseNumber(' 12,50 € ')).toBe(12.5)
    expect(parseNumber('€1.234,56')).toBe(1234.56)
  })

  it('keeps the sign', () => {
    expect(parseNumber('-3,50')).toBe(-3.5)
  })

  it('handles a value with no whole part', () => {
    expect(parseNumber(',75')).toBe(0.75)
  })

  it('returns null when there is no number', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('   ')).toBeNull()
    expect(parseNumber('N/D')).toBeNull()
    expect(parseNumber(null)).toBeNull()
    expect(parseNumber(undefined)).toBeNull()
  })
})

describe('parseInteger', () => {
  it('drops the decimal part', () => {
    expect(parseInteger('12,9')).toBe(12)
    expect(parseInteger('6')).toBe(6)
  })
})

describe('parseIva', () => {
  it('accepts a percentage written either way', () => {
    expect(parseIva('21')).toBe(21)
    expect(parseIva('21%')).toBe(21)
    expect(parseIva('0,21')).toBe(21)
    expect(parseIva('10,5')).toBe(10.5)
  })

  it('leaves zero alone', () => {
    expect(parseIva('0')).toBe(0)
  })
})
