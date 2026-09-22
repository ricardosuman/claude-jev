import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Tag = {
  id: string
  createdAt: number
  updatedAt: number
  name: string
  color: string
}

export type TagInput = {
  name?: string
  color?: string
}

export const TAG_PREFIX = 'tag'

export function makeTag(input: TagInput = {}): Tag {
  const at = now()
  return {
    id: nextId('tag'),
    createdAt: at,
    updatedAt: at,
    name: input.name ?? 'inbox',
    color: input.color ?? 'gray',
  }
}

export function touchTag(row: Tag, patch: TagInput = {}): Tag {
  const next = { ...row, updatedAt: now() }
  if (patch.name !== undefined) next.name = patch.name
  if (patch.color !== undefined) next.color = patch.color
  return next
}

export function summarizeTag(row: Tag): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isTag(value: unknown): value is Tag {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Tag).id === 'string'
}

export function sortTags(rows: Tag[]): Tag[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
