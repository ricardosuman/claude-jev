import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Bulletin = {
  id: string
  createdAt: number
  updatedAt: number
  addr: string
  subject: string
  body: string
}

export type BulletinInput = {
  addr?: string
  subject?: string
  body?: string
}

export const BULLETIN_PREFIX = 'bul'

export function makeBulletin(input: BulletinInput = {}): Bulletin {
  const at = now()
  return {
    id: nextId('bul'),
    createdAt: at,
    updatedAt: at,
    addr: input.addr ?? 'ops@lodge.test',
    subject: input.subject ?? 'digest',
    body: input.body ?? '',
  }
}

export function touchBulletin(row: Bulletin, patch: BulletinInput = {}): Bulletin {
  const next = { ...row, updatedAt: now() }
  if (patch.addr !== undefined) next.addr = patch.addr
  if (patch.subject !== undefined) next.subject = patch.subject
  if (patch.body !== undefined) next.body = patch.body
  return next
}

export function summarizeBulletin(row: Bulletin): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isBulletin(value: unknown): value is Bulletin {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Bulletin).id === 'string'
}

export function sortBulletins(rows: Bulletin[]): Bulletin[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function cloneBulletin(row: Bulletin): Bulletin {
  return { ...row }
}

export function idsOfBulletins(rows: Bulletin[]): string[] {
  return rows.map(row => row.id)
}

export function blankBulletinInput(): BulletinInput {
  return {}
}

export function hasId(row: Bulletin, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Bulletin, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
