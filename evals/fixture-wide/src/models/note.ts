import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Note = {
  id: string
  createdAt: number
  updatedAt: number
  userId: string
  body: string
  pinned: boolean
}

export type NoteInput = {
  userId?: string
  body?: string
  pinned?: boolean
}

export const NOTE_PREFIX = 'nte'

export function makeNote(input: NoteInput = {}): Note {
  const at = now()
  return {
    id: nextId('nte'),
    createdAt: at,
    updatedAt: at,
    userId: input.userId ?? 'usr_1',
    body: input.body ?? '',
    pinned: input.pinned ?? false,
  }
}

export function touchNote(row: Note, patch: NoteInput = {}): Note {
  const next = { ...row, updatedAt: now() }
  if (patch.userId !== undefined) next.userId = patch.userId
  if (patch.body !== undefined) next.body = patch.body
  if (patch.pinned !== undefined) next.pinned = patch.pinned
  return next
}

export function summarizeNote(row: Note): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isNote(value: unknown): value is Note {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Note).id === 'string'
}

export function sortNotes(rows: Note[]): Note[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
