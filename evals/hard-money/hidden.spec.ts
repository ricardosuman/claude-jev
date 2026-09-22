import { expect, test } from 'bun:test'
import { allocate } from './money'

test('splits and rounds to the currency', () => {
  expect(allocate('100.00', 'USD', [1, 1, 1])).toEqual(['33.34', '33.33', '33.33'])
  expect(allocate('1000', 'JPY', [1, 1, 1])).toEqual(['334', '333', '333'])
  expect(allocate('10.000', 'BHD', [1, 2])).toEqual(['3.333', '6.667'])
  expect(allocate('12.5', 'USD', [1, 1])).toEqual(['6.25', '6.25'])
  expect(allocate('100', 'EUR', [1])).toEqual(['100.00'])
})

test('leftovers go to the largest remainders, ties to the earlier share', () => {
  expect(allocate('0.05', 'USD', [1, 3])).toEqual(['0.01', '0.04'])
  expect(allocate('0.10', 'USD', [1, 1, 1])).toEqual(['0.04', '0.03', '0.03'])
  expect(allocate('1.00', 'USD', [0, 1, 2])).toEqual(['0.00', '0.33', '0.67'])
})

test('a refund mirrors the payment', () => {
  expect(allocate('-100.00', 'USD', [1, 1, 1])).toEqual(['-33.34', '-33.33', '-33.33'])
  expect(allocate('-0.05', 'USD', [1, 3])).toEqual(['-0.01', '-0.04'])
  expect(allocate('-0.01', 'USD', [1, 1])).toEqual(['-0.01', '0.00'])
})

test('large amounts stay exact', () => {
  expect(allocate('92233720368547758.07', 'USD', [1, 1])).toEqual(['46116860184273879.04', '46116860184273879.03'])
  expect(allocate('9007199254740993', 'JPY', [1, 2])).toEqual(['3002399751580331', '6004799503160662'])
})

test('shares always add up to the total', () => {
  for (const [total, weights] of [['0.07', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]], ['999.99', [7, 13, 29]], ['-19.99', [3, 3, 1]]] as const) {
    const cents = allocate(total, 'USD', [...weights]).reduce((sum, s) => sum + Math.round(Number(s) * 100), 0)
    expect(cents).toBe(Math.round(Number(total) * 100))
  }
})
