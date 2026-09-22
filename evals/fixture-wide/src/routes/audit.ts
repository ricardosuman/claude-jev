import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as audits from '../services/auditService'
import type { AuditInput } from '../models/audit'

export function list(store: Store, query: Query = {}): Result {
  return json(audits.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = audits.get(store, id)
  if (!row) throw notFound('audit')
  return json(row)
}

export function create(store: Store, input: AuditInput): Result {
  return created(audits.create(store, input))
}

export function update(store: Store, id: string, input: AuditInput): Result {
  return json(audits.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  audits.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: audits.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: audits.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(audits.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = audits.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(audits.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

