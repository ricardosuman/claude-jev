import { expect, test } from 'bun:test'
import { formatAmount } from './money'

test('formatAmount', () => {
  expect(formatAmount('1234.5', 'EUR')).toBe('1234.50 EUR')
  expect(formatAmount('500', 'JPY')).toBe('500 JPY')
})
