import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Principal = {
  id: string
  createdAt: number
  updatedAt: number
  addr: string
  handle: string
  rank: string
}

export type PrincipalInput = {
  addr?: string
  handle?: string
  rank?: string
}

export const PRINCIPAL_PREFIX = 'prn'

export function makePrincipal(input: PrincipalInput = {}): Principal {
  const at = now()
  return {
    id: nextId('prn'),
    createdAt: at,
    updatedAt: at,
    addr: input.addr ?? 'ada@lodge.test',
    handle: input.handle ?? 'Ada',
    rank: input.rank ?? 'member',
  }
}

export function touchPrincipal(row: Principal, patch: PrincipalInput = {}): Principal {
  const next = { ...row, updatedAt: now() }
  if (patch.addr !== undefined) next.addr = patch.addr
  if (patch.handle !== undefined) next.handle = patch.handle
  if (patch.rank !== undefined) next.rank = patch.rank
  return next
}

export function summarizePrincipal(row: Principal): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isPrincipal(value: unknown): value is Principal {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Principal).id === 'string'
}

export function sortPrincipals(rows: Principal[]): Principal[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function clonePrincipal(row: Principal): Principal {
  return { ...row }
}

export function idsOfPrincipals(rows: Principal[]): string[] {
  return rows.map(row => row.id)
}

export function blankPrincipalInput(): PrincipalInput {
  return {}
}

export function hasId(row: Principal, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Principal, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
