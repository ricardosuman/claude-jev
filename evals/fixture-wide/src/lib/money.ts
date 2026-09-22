export const MINOR: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, JPY: 0 }

export function minorUnits(currency: string): number {
  const n = MINOR[currency]
  if (n === undefined) throw new Error('unknown currency: ' + currency)
  return n
}

export function parseAmount(text: string, currency: string): number {
  const digits = minorUnits(currency)
  const n = Number(text)
  if (!Number.isFinite(n)) throw new Error('bad amount: ' + text)
  return Math.round(n * 10 ** digits)
}

export function formatAmount(minor: number, currency: string): string {
  const digits = minorUnits(currency)
  return (minor / 10 ** digits).toFixed(digits)
}

export function add(a: number, b: number): number {
  return a + b
}

export function sub(a: number, b: number): number {
  return a - b
}

export function pct(minor: number, basisPoints: number): number {
  return Math.trunc((minor * basisPoints) / 10_000)
}

export function clampMinor(minor: number): number {
  if (!Number.isInteger(minor)) throw new Error('amount must be integer minor units')
  return minor
}

export function sum(minors: number[]): number {
  let n = 0
  for (const m of minors) n += m
  return n
}

export function abs(minor: number): number {
  return minor < 0 ? -minor : minor
}

export function cmp(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function isZero(minor: number): boolean {
  return minor === 0
}
