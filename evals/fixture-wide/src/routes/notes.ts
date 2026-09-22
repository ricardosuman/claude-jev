import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as notes from '../services/noteService'
import type { NoteInput } from '../models/note'

export function list(store: Store, query: Query = {}): Result {
  return json(notes.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = notes.get(store, id)
  if (!row) throw notFound('note')
  return json(row)
}

export function create(store: Store, input: NoteInput): Result {
  return created(notes.create(store, input))
}

export function update(store: Store, id: string, input: NoteInput): Result {
  return json(notes.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  notes.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: notes.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: notes.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(notes.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = notes.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(notes.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

