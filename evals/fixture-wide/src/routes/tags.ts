import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as tags from '../services/tagService'
import type { TagInput } from '../models/tag'

export function list(store: Store, query: Query = {}): Result {
  return json(tags.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = tags.get(store, id)
  if (!row) throw notFound('tag')
  return json(row)
}

export function create(store: Store, input: TagInput): Result {
  return created(tags.create(store, input))
}

export function update(store: Store, id: string, input: TagInput): Result {
  return json(tags.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  tags.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: tags.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: tags.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(tags.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = tags.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(tags.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

