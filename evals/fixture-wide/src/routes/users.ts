import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as users from '../services/userService'
import type { UserInput } from '../models/user'

export function list(store: Store, query: Query = {}): Result {
  return json(users.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = users.get(store, id)
  if (!row) throw notFound('user')
  return json(row)
}

export function create(store: Store, input: UserInput): Result {
  return created(users.create(store, input))
}

export function update(store: Store, id: string, input: UserInput): Result {
  return json(users.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  users.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: users.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: users.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(users.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = users.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(users.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

