import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as inventorys from '../services/inventoryService'
import type { InventoryInput } from '../models/inventory'

export function list(store: Store, query: Query = {}): Result {
  return json(inventorys.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = inventorys.get(store, id)
  if (!row) throw notFound('inventory')
  return json(row)
}

export function create(store: Store, input: InventoryInput): Result {
  return created(inventorys.create(store, input))
}

export function update(store: Store, id: string, input: InventoryInput): Result {
  return json(inventorys.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  inventorys.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: inventorys.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: inventorys.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(inventorys.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = inventorys.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(inventorys.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

