import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Tally = {
  id: string
  createdAt: number
  updatedAt: number
  principalId: string
  lines: number
  phase: string
}

export type TallyInput = {
  principalId?: string
  lines?: number
  phase?: string
}

export const TALLY_PREFIX = 'tal'

export function makeTally(input: TallyInput = {}): Tally {
  const at = now()
  return {
    id: nextId('tal'),
    createdAt: at,
    updatedAt: at,
    principalId: input.principalId ?? 'prn_1',
    lines: input.lines ?? 0,
    phase: input.phase ?? 'open',
  }
}

export function touchTally(row: Tally, patch: TallyInput = {}): Tally {
  const next = { ...row, updatedAt: now() }
  if (patch.principalId !== undefined) next.principalId = patch.principalId
  if (patch.lines !== undefined) next.lines = patch.lines
  if (patch.phase !== undefined) next.phase = patch.phase
  return next
}

export function summarizeTally(row: Tally): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isTally(value: unknown): value is Tally {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Tally).id === 'string'
}

export function sortTallys(rows: Tally[]): Tally[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function cloneTally(row: Tally): Tally {
  return { ...row }
}

export function idsOfTallys(rows: Tally[]): string[] {
  return rows.map(row => row.id)
}

export function blankTallyInput(): TallyInput {
  return {}
}

export function hasId(row: Tally, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Tally, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
