import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Tribute = {
  id: string
  createdAt: number
  updatedAt: number
  allotmentId: string
  minor: number
  phase: string
}

export type TributeInput = {
  allotmentId?: string
  minor?: number
  phase?: string
}

export const TRIBUTE_PREFIX = 'trb'

export function makeTribute(input: TributeInput = {}): Tribute {
  const at = now()
  return {
    id: nextId('trb'),
    createdAt: at,
    updatedAt: at,
    allotmentId: input.allotmentId ?? 'alt_1',
    minor: input.minor ?? 0,
    phase: input.phase ?? 'open',
  }
}

export function touchTribute(row: Tribute, patch: TributeInput = {}): Tribute {
  const next = { ...row, updatedAt: now() }
  if (patch.allotmentId !== undefined) next.allotmentId = patch.allotmentId
  if (patch.minor !== undefined) next.minor = patch.minor
  if (patch.phase !== undefined) next.phase = patch.phase
  return next
}

export function summarizeTribute(row: Tribute): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isTribute(value: unknown): value is Tribute {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Tribute).id === 'string'
}

export function sortTributes(rows: Tribute[]): Tribute[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function cloneTribute(row: Tribute): Tribute {
  return { ...row }
}

export function idsOfTributes(rows: Tribute[]): string[] {
  return rows.map(row => row.id)
}

export function blankTributeInput(): TributeInput {
  return {}
}

export function hasId(row: Tribute, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Tribute, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
