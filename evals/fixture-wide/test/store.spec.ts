import { expect, test } from 'bun:test'
import { createStore, put, size } from '../src/lib/store'
import { makeUser } from '../src/models/user'
import { makeItem } from '../src/models/item'
import * as items from '../src/services/itemService'

test('store roundtrip', () => {
  const store = createStore()
  const user = put(store.users, makeUser({ email: 'a@b.c', name: 'A' }))
  expect(store.users.get(user.id)?.email).toBe('a@b.c')
  expect(size(store).users).toBe(1)
})

test('item create stores sku as given', () => {
  const store = createStore()
  const item = items.create(store, { sku: 'ABCD1234', name: 'x', price: '1.00' })
  expect(item.sku).toBe('ABCD1234')
  expect(items.get(store, item.id)?.name).toBe('x')
})

test('item update and remove', () => {
  const store = createStore()
  const item = items.create(store, { sku: 'ABCD1234', name: 'x', price: '1.00' })
  items.update(store, item.id, { name: 'y' })
  expect(items.require(store, item.id).name).toBe('y')
  items.remove(store, item.id)
  expect(items.get(store, item.id)).toBeUndefined()
})

test('size starts at zero', () => {
  const counts = size(createStore())
  expect(counts.users).toBe(0)
  expect(counts.orders).toBe(0)
  expect(counts.items).toBe(0)
})

test('user put is retrievable', () => {
  const store = createStore()
  const user = put(store.users, makeUser({ email: 'b@c.d', name: 'B' }))
  expect(store.users.has(user.id)).toBe(true)
  expect(size(store).users).toBe(1)
})
