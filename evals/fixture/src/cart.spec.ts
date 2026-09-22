import { expect, test } from 'bun:test'
import { subtotal, total } from './cart'

const items = [
  { name: 'pen', price: 2, qty: 3 },
  { name: 'pad', price: 4, qty: 1 },
]

test('subtotal sums price times qty', () => {
  expect(subtotal(items)).toBe(10)
})

test('total applies discount then tax', () => {
  expect(total(items)).toBe(10.8)
  expect(total(items, 50)).toBe(5.4)
})
