import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Allotment = {
  id: string
  createdAt: number
  updatedAt: number
  principalId: string
  berthId: string
  phase: string
  blazon: string
  unwoundAt: number | null
}

export type AllotmentInput = {
  principalId?: string
  berthId?: string
  phase?: string
  blazon?: string
  unwoundAt?: number | null
}

export const ALLOTMENT_PREFIX = 'alt'

export function makeAllotment(input: AllotmentInput = {}): Allotment {
  const at = now()
  return {
    id: nextId('alt'),
    createdAt: at,
    updatedAt: at,
    principalId: input.principalId ?? 'prn_1',
    berthId: input.berthId ?? 'brt_1',
    phase: input.phase ?? 'held',
    blazon: input.blazon ?? 'ABCDEFGH',
    unwoundAt: input.unwoundAt ?? null,
  }
}

export function touchAllotment(row: Allotment, patch: AllotmentInput = {}): Allotment {
  const next = { ...row, updatedAt: now() }
  if (patch.principalId !== undefined) next.principalId = patch.principalId
  if (patch.berthId !== undefined) next.berthId = patch.berthId
  if (patch.phase !== undefined) next.phase = patch.phase
  if (patch.blazon !== undefined) next.blazon = patch.blazon
  if (patch.unwoundAt !== undefined) next.unwoundAt = patch.unwoundAt
  return next
}

export function summarizeAllotment(row: Allotment): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isAllotment(value: unknown): value is Allotment {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Allotment).id === 'string'
}

export function sortAllotments(rows: Allotment[]): Allotment[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function cloneAllotment(row: Allotment): Allotment {
  return { ...row }
}

export function idsOfAllotments(rows: Allotment[]): string[] {
  return rows.map(row => row.id)
}

export function blankAllotmentInput(): AllotmentInput {
  return {}
}

export function hasId(row: Allotment, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Allotment, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}

export function isUnwound(row: Allotment): boolean {
  return row.unwoundAt !== null
}
