import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeOrder, sortOrders, touchOrder, type Order, type OrderInput } from '../models/order'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<Order> {
  const { page, limit } = parsePage(query)
  return slice(sortOrders(all(store.orders)), page, limit)
}

export function get(store: Store, id: string): Order | undefined {
  return store.orders.get(id)
}

export function require(store: Store, id: string): Order {
  const row = get(store, id)
  if (!row) throw notFound('order')
  return row
}


export function create(store: Store, input: OrderInput): Order {
  const row = makeOrder(input)
  return put(store.orders, row)
}

export function update(store: Store, id: string, patch: OrderInput): Order {
  const row = require(store, id)
  const next = touchOrder(row, patch)
  info('order.update', { id })
  return put(store.orders, next)
}

export function remove(store: Store, id: string): void {
  if (!store.orders.delete(id)) throw notFound('order')
}

export function count(store: Store): number {
  return store.orders.size
}

export function filter(store: Store, pred: (row: Order) => boolean): Order[] {
  return all(store.orders).filter(pred)
}
