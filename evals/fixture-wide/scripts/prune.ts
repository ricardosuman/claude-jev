import { createStore, all, type Store } from '../src/lib/store'
import { now, addHours } from '../src/lib/clock'
import { info } from '../src/lib/logger'

export function pruneSessions(store: Store, cutoff: number): number {
  let n = 0
  for (const session of all(store.sessions)) {
    if (session.revokedAt && session.revokedAt < cutoff) {
      store.sessions.delete(session.id)
      n++
    }
  }
  return n
}

export function pruneNotes(store: Store, cutoff: number): number {
  let n = 0
  for (const note of all(store.notes)) {
    if (note.createdAt < cutoff && !note.pinned) {
      store.notes.delete(note.id)
      n++
    }
  }
  return n
}

export function pruneReports(store: Store, cutoff: number): number {
  let n = 0
  for (const row of all(store.reports)) {
    if (row.createdAt < cutoff && row.status === 'queued') {
      store.reports.delete(row.id)
      n++
    }
  }
  return n
}

export function cutoffFromHours(olderThanHours: number): number {
  return addHours(now(), -olderThanHours)
}

export function prune(store = createStore(), olderThanHours = 24) {
  const cutoff = cutoffFromHours(olderThanHours)
  const sessions = pruneSessions(store, cutoff)
  const notes = pruneNotes(store, cutoff)
  const reports = pruneReports(store, cutoff)
  info('prune', { sessions, notes, reports, olderThanHours })
  return sessions + notes + reports
}

if (import.meta.main) prune()
