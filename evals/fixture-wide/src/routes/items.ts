import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as items from '../services/itemService'
import type { ItemInput } from '../models/item'

export function list(store: Store, query: Query = {}): Result {
  return json(items.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = items.get(store, id)
  if (!row) throw notFound('item')
  return json(row)
}

export function create(store: Store, input: ItemInput): Result {
  return created(items.create(store, input))
}

export function update(store: Store, id: string, input: ItemInput): Result {
  return json(items.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  items.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: items.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: items.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(items.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = items.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(items.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

