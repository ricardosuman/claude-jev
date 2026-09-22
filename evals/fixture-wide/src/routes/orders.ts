import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as orders from '../services/orderService'
import type { OrderInput } from '../models/order'

export function list(store: Store, query: Query = {}): Result {
  return json(orders.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = orders.get(store, id)
  if (!row) throw notFound('order')
  return json(row)
}

export function create(store: Store, input: OrderInput): Result {
  return created(orders.create(store, input))
}

export function update(store: Store, id: string, input: OrderInput): Result {
  return json(orders.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  orders.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: orders.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: orders.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(orders.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = orders.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(orders.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

export function cancel(store: Store, id: string): Result {
  const order = orders.get(store, id)
  if (!order) throw notFound('order')
  if (order.status === 'cancelled') throw conflict('already cancelled')
  return json(orders.update(store, id, { status: 'cancelled' }))
}

