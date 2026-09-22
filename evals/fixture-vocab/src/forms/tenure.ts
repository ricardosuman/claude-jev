import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Tenure = {
  id: string
  createdAt: number
  updatedAt: number
  principalId: string
  sigil: string
  unboundAt: number | null
}

export type TenureInput = {
  principalId?: string
  sigil?: string
  unboundAt?: number | null
}

export const TENURE_PREFIX = 'ten'

export function makeTenure(input: TenureInput = {}): Tenure {
  const at = now()
  return {
    id: nextId('ten'),
    createdAt: at,
    updatedAt: at,
    principalId: input.principalId ?? 'prn_1',
    sigil: input.sigil ?? 'sig',
    unboundAt: input.unboundAt ?? null,
  }
}

export function touchTenure(row: Tenure, patch: TenureInput = {}): Tenure {
  const next = { ...row, updatedAt: now() }
  if (patch.principalId !== undefined) next.principalId = patch.principalId
  if (patch.sigil !== undefined) next.sigil = patch.sigil
  if (patch.unboundAt !== undefined) next.unboundAt = patch.unboundAt
  return next
}

export function summarizeTenure(row: Tenure): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isTenure(value: unknown): value is Tenure {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Tenure).id === 'string'
}

export function sortTenures(rows: Tenure[]): Tenure[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function cloneTenure(row: Tenure): Tenure {
  return { ...row }
}

export function idsOfTenures(rows: Tenure[]): string[] {
  return rows.map(row => row.id)
}

export function blankTenureInput(): TenureInput {
  return {}
}

export function hasId(row: Tenure, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Tenure, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
