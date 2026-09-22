import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeNote, sortNotes, touchNote, type Note, type NoteInput } from '../models/note'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<Note> {
  const { page, limit } = parsePage(query)
  return slice(sortNotes(all(store.notes)), page, limit)
}

export function get(store: Store, id: string): Note | undefined {
  return store.notes.get(id)
}

export function require(store: Store, id: string): Note {
  const row = get(store, id)
  if (!row) throw notFound('note')
  return row
}


export function create(store: Store, input: NoteInput): Note {
  const row = makeNote(input)
  return put(store.notes, row)
}

export function update(store: Store, id: string, patch: NoteInput): Note {
  const row = require(store, id)
  const next = touchNote(row, patch)
  info('note.update', { id })
  return put(store.notes, next)
}

export function remove(store: Store, id: string): void {
  if (!store.notes.delete(id)) throw notFound('note')
}

export function count(store: Store): number {
  return store.notes.size
}

export function filter(store: Store, pred: (row: Note) => boolean): Note[] {
  return all(store.notes).filter(pred)
}
