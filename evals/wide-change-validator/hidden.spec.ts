import { expect, test } from 'bun:test'
import { AppError } from './lib/errors'
import { createStore } from './lib/store'
import { assertSku } from './lib/validate'
import { create } from './services/itemService'

test('assertSku accepts 8-16 uppercase alphanumeric', () => {
  expect(assertSku('ABCD1234')).toBe('ABCD1234')
  expect(assertSku('ABCDEFGHIJ123456')).toBe('ABCDEFGHIJ123456')
})

test('assertSku rejects short, long, lowercase, and punctuation', () => {
  for (const sku of ['ABCD123', 'ABCDEFGHIJ1234567', 'abcd1234', 'ABCD-234']) {
    try {
      assertSku(sku)
      throw new Error('accepted ' + sku)
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).status).toBe(400)
    }
  }
})

test('create rejects a bad SKU and accepts a good one', () => {
  const store = createStore()
  try {
    create(store, { sku: 'nope', name: 'x', price: '1.00' })
    throw new Error('accepted bad sku')
  } catch (err) {
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).status).toBe(400)
  }
  const item = create(store, { sku: 'WIDG0001', name: 'widget', price: '9.00' })
  expect(item.sku).toBe('WIDG0001')
})
