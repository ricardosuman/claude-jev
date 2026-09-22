import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as sessions from '../services/sessionService'
import type { SessionInput } from '../models/session'

export function list(store: Store, query: Query = {}): Result {
  return json(sessions.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = sessions.get(store, id)
  if (!row) throw notFound('session')
  return json(row)
}

export function create(store: Store, input: SessionInput): Result {
  return created(sessions.create(store, input))
}

export function update(store: Store, id: string, input: SessionInput): Result {
  return json(sessions.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  sessions.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: sessions.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: sessions.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(sessions.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = sessions.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(sessions.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

export function revoke(store: Store, id: string): Result {
  const session = sessions.get(store, id)
  if (!session) throw notFound('session')
  if (session.revokedAt) throw conflict('already revoked')
  return json(sessions.revoke(store, id))
}

export function touch(store: Store, id: string): Result {
  const session = sessions.require(store, id)
  return json(session)
}

