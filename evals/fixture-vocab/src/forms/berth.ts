import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Berth = {
  id: string
  createdAt: number
  updatedAt: number
  label: string
  wing: string
  tariffMinor: number
}

export type BerthInput = {
  label?: string
  wing?: string
  tariffMinor?: number
}

export const BERTH_PREFIX = 'brt'

export function makeBerth(input: BerthInput = {}): Berth {
  const at = now()
  return {
    id: nextId('brt'),
    createdAt: at,
    updatedAt: at,
    label: input.label ?? 'A1',
    wing: input.wing ?? 'east',
    tariffMinor: input.tariffMinor ?? 9000,
  }
}

export function touchBerth(row: Berth, patch: BerthInput = {}): Berth {
  const next = { ...row, updatedAt: now() }
  if (patch.label !== undefined) next.label = patch.label
  if (patch.wing !== undefined) next.wing = patch.wing
  if (patch.tariffMinor !== undefined) next.tariffMinor = patch.tariffMinor
  return next
}

export function summarizeBerth(row: Berth): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isBerth(value: unknown): value is Berth {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Berth).id === 'string'
}

export function sortBerths(rows: Berth[]): Berth[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function cloneBerth(row: Berth): Berth {
  return { ...row }
}

export function idsOfBerths(rows: Berth[]): string[] {
  return rows.map(row => row.id)
}

export function blankBerthInput(): BerthInput {
  return {}
}

export function hasId(row: Berth, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Berth, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
