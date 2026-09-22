import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeSession, sortSessions, touchSession, type Session, type SessionInput } from '../models/session'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'
import { token } from '../lib/ids'
import { now } from '../lib/clock'
import { assertPresent } from '../lib/validate'

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<Session> {
  const { page, limit } = parsePage(query)
  return slice(sortSessions(all(store.sessions)), page, limit)
}

export function get(store: Store, id: string): Session | undefined {
  return store.sessions.get(id)
}

export function require(store: Store, id: string): Session {
  const row = get(store, id)
  if (!row) throw notFound('session')
  return row
}


export function create(store: Store, input: SessionInput): Session {
  assertPresent(input.userId, 'userId')
  const row = makeSession({ ...input, token: input.token ?? token(20), revokedAt: null })
  return put(store.sessions, row)
}

export function revoke(store: Store, id: string): Session {
  const row = get(store, id)
  if (!row) throw notFound('session')
  return put(store.sessions, touchSession(row, { revokedAt: now() }))
}

export function update(store: Store, id: string, patch: SessionInput): Session {
  const row = require(store, id)
  const next = touchSession(row, patch)
  info('session.update', { id })
  return put(store.sessions, next)
}

export function remove(store: Store, id: string): void {
  if (!store.sessions.delete(id)) throw notFound('session')
}

export function count(store: Store): number {
  return store.sessions.size
}

export function filter(store: Store, pred: (row: Session) => boolean): Session[] {
  return all(store.sessions).filter(pred)
}
