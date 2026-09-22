import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as catalogs from '../services/catalogService'
import type { CatalogInput } from '../models/catalog'

export function list(store: Store, query: Query = {}): Result {
  return json(catalogs.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = catalogs.get(store, id)
  if (!row) throw notFound('catalog')
  return json(row)
}

export function create(store: Store, input: CatalogInput): Result {
  return created(catalogs.create(store, input))
}

export function update(store: Store, id: string, input: CatalogInput): Result {
  return json(catalogs.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  catalogs.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: catalogs.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: catalogs.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(catalogs.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = catalogs.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(catalogs.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

