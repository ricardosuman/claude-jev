import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeAudit, sortAudits, touchAudit, type Audit, type AuditInput } from '../models/audit'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<Audit> {
  const { page, limit } = parsePage(query)
  return slice(sortAudits(all(store.audit)), page, limit)
}

export function get(store: Store, id: string): Audit | undefined {
  return store.audit.get(id)
}

export function require(store: Store, id: string): Audit {
  const row = get(store, id)
  if (!row) throw notFound('audit')
  return row
}


export function create(store: Store, input: AuditInput): Audit {
  const row = makeAudit(input)
  return put(store.audit, row)
}

export function update(store: Store, id: string, patch: AuditInput): Audit {
  const row = require(store, id)
  const next = touchAudit(row, patch)
  info('audit.update', { id })
  return put(store.audit, next)
}

export function remove(store: Store, id: string): void {
  if (!store.audit.delete(id)) throw notFound('audit')
}

export function count(store: Store): number {
  return store.audit.size
}

export function filter(store: Store, pred: (row: Audit) => boolean): Audit[] {
  return all(store.audit).filter(pred)
}
