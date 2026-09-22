import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as reports from '../services/reportService'
import type { ReportInput } from '../models/report'

export function list(store: Store, query: Query = {}): Result {
  return json(reports.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = reports.get(store, id)
  if (!row) throw notFound('report')
  return json(row)
}

export function create(store: Store, input: ReportInput): Result {
  return created(reports.create(store, input))
}

export function update(store: Store, id: string, input: ReportInput): Result {
  return json(reports.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  reports.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: reports.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: reports.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(reports.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = reports.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(reports.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

