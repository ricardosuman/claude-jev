import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Session = {
  id: string
  createdAt: number
  updatedAt: number
  userId: string
  token: string
  revokedAt: number | null
}

export type SessionInput = {
  userId?: string
  token?: string
  revokedAt?: number | null
}

export const SESSION_PREFIX = 'ses'

export function makeSession(input: SessionInput = {}): Session {
  const at = now()
  return {
    id: nextId('ses'),
    createdAt: at,
    updatedAt: at,
    userId: input.userId ?? 'usr_1',
    token: input.token ?? 'tok',
    revokedAt: input.revokedAt ?? null,
  }
}

export function touchSession(row: Session, patch: SessionInput = {}): Session {
  const next = { ...row, updatedAt: now() }
  if (patch.userId !== undefined) next.userId = patch.userId
  if (patch.token !== undefined) next.token = patch.token
  if (patch.revokedAt !== undefined) next.revokedAt = patch.revokedAt
  return next
}

export function summarizeSession(row: Session): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isSession(value: unknown): value is Session {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Session).id === 'string'
}

export function sortSessions(rows: Session[]): Session[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
