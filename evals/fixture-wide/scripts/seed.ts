import { createStore, put, size, type Store } from '../src/lib/store'
import { makeUser } from '../src/models/user'
import { makeItem } from '../src/models/item'
import { makeOrder } from '../src/models/order'
import { makeShipment } from '../src/models/shipment'
import { makeNote } from '../src/models/note'
import { makeTag } from '../src/models/tag'
import { info } from '../src/lib/logger'

const SKUS = ['WIDG0001', 'WIDG0002', 'BOLT0001', 'NUT00001']

export function seedUser(store: Store, email: string, name: string, role = 'member') {
  return put(store.users, makeUser({ email, name, role }))
}

export function seedItem(store: Store, sku: string, name: string, price = '9.00') {
  return put(store.items, makeItem({ sku, name, price }))
}

export function seedOrder(store: Store, userId: string, total = 900) {
  return put(store.orders, makeOrder({ userId, status: 'open', total }))
}

export function seedNote(store: Store, userId: string, body: string) {
  return put(store.notes, makeNote({ userId, body }))
}

export function seedTag(store: Store, name: string, color = 'gray') {
  return put(store.tags, makeTag({ name, color }))
}

export function seedShipment(store: Store, orderId: string, carrier = 'dhl') {
  return put(store.shipments, makeShipment({ orderId, status: 'pending', carrier }))
}

export function skus(): string[] {
  return [...SKUS]
}

export function seed() {
  const store = createStore()
  const user = seedUser(store, 'ada@harbor.test', 'Ada', 'admin')
  seedUser(store, 'al@harbor.test', 'Al')
  for (const sku of SKUS) seedItem(store, sku, sku.toLowerCase())
  const order = seedOrder(store, user.id)
  seedShipment(store, order.id)
  seedNote(store, user.id, 'first')
  seedTag(store, 'inbox')
  info('seed', size(store))
  return store
}

if (import.meta.main) seed()
