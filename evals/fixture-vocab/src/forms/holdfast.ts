import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Holdfast = {
  id: string
  createdAt: number
  updatedAt: number
  principalId: string
  berthId: string
  phase: string
}

export type HoldfastInput = {
  principalId?: string
  berthId?: string
  phase?: string
}

export const HOLDFAST_PREFIX = 'hld'

export function makeHoldfast(input: HoldfastInput = {}): Holdfast {
  const at = now()
  return {
    id: nextId('hld'),
    createdAt: at,
    updatedAt: at,
    principalId: input.principalId ?? 'prn_1',
    berthId: input.berthId ?? 'brt_1',
    phase: input.phase ?? 'waiting',
  }
}

export function touchHoldfast(row: Holdfast, patch: HoldfastInput = {}): Holdfast {
  const next = { ...row, updatedAt: now() }
  if (patch.principalId !== undefined) next.principalId = patch.principalId
  if (patch.berthId !== undefined) next.berthId = patch.berthId
  if (patch.phase !== undefined) next.phase = patch.phase
  return next
}

export function summarizeHoldfast(row: Holdfast): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isHoldfast(value: unknown): value is Holdfast {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Holdfast).id === 'string'
}

export function sortHoldfasts(rows: Holdfast[]): Holdfast[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function cloneHoldfast(row: Holdfast): Holdfast {
  return { ...row }
}

export function idsOfHoldfasts(rows: Holdfast[]): string[] {
  return rows.map(row => row.id)
}

export function blankHoldfastInput(): HoldfastInput {
  return {}
}

export function hasId(row: Holdfast, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Holdfast, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
