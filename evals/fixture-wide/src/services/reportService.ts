import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeReport, sortReports, touchReport, type Report, type ReportInput } from '../models/report'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<Report> {
  const { page, limit } = parsePage(query)
  return slice(sortReports(all(store.reports)), page, limit)
}

export function get(store: Store, id: string): Report | undefined {
  return store.reports.get(id)
}

export function require(store: Store, id: string): Report {
  const row = get(store, id)
  if (!row) throw notFound('report')
  return row
}


export function create(store: Store, input: ReportInput): Report {
  const row = makeReport(input)
  return put(store.reports, row)
}

export function update(store: Store, id: string, patch: ReportInput): Report {
  const row = require(store, id)
  const next = touchReport(row, patch)
  info('report.update', { id })
  return put(store.reports, next)
}

export function remove(store: Store, id: string): void {
  if (!store.reports.delete(id)) throw notFound('report')
}

export function count(store: Store): number {
  return store.reports.size
}

export function filter(store: Store, pred: (row: Report) => boolean): Report[] {
  return all(store.reports).filter(pred)
}
