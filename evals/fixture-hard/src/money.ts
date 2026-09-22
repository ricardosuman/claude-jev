// Amounts cross the API as decimal strings ('1234.50') so large values stay exact.

/** Digits after the decimal point for each currency we bill in. */
export const MINOR_UNITS: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, JPY: 0, KRW: 0, BHD: 3, KWD: 3 }

/** Display form of an amount, e.g. formatAmount('1234.5', 'EUR') -> '1234.50 EUR'. */
export function formatAmount(amount: string, currency: string): string {
  const digits = MINOR_UNITS[currency]
  if (digits === undefined) throw new Error(`unknown currency: ${currency}`)
  return `${Number(amount).toFixed(digits)} ${currency}`
}
