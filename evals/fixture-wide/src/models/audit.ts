import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Audit = {
  id: string
  createdAt: number
  updatedAt: number
  actorId: string
  action: string
  target: string
}

export type AuditInput = {
  actorId?: string
  action?: string
  target?: string
}

export const AUDIT_PREFIX = 'aud'

export function makeAudit(input: AuditInput = {}): Audit {
  const at = now()
  return {
    id: nextId('aud'),
    createdAt: at,
    updatedAt: at,
    actorId: input.actorId ?? 'usr_1',
    action: input.action ?? 'read',
    target: input.target ?? '',
  }
}

export function touchAudit(row: Audit, patch: AuditInput = {}): Audit {
  const next = { ...row, updatedAt: now() }
  if (patch.actorId !== undefined) next.actorId = patch.actorId
  if (patch.action !== undefined) next.action = patch.action
  if (patch.target !== undefined) next.target = patch.target
  return next
}

export function summarizeAudit(row: Audit): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isAudit(value: unknown): value is Audit {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Audit).id === 'string'
}

export function sortAudits(rows: Audit[]): Audit[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
