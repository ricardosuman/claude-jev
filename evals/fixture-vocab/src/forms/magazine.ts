import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Magazine = {
  id: string
  createdAt: number
  updatedAt: number
  berthId: string
  qty: number
  wing: string
}

export type MagazineInput = {
  berthId?: string
  qty?: number
  wing?: string
}

export const MAGAZINE_PREFIX = 'mag'

export function makeMagazine(input: MagazineInput = {}): Magazine {
  const at = now()
  return {
    id: nextId('mag'),
    createdAt: at,
    updatedAt: at,
    berthId: input.berthId ?? 'brt_1',
    qty: input.qty ?? 0,
    wing: input.wing ?? 'east',
  }
}

export function touchMagazine(row: Magazine, patch: MagazineInput = {}): Magazine {
  const next = { ...row, updatedAt: now() }
  if (patch.berthId !== undefined) next.berthId = patch.berthId
  if (patch.qty !== undefined) next.qty = patch.qty
  if (patch.wing !== undefined) next.wing = patch.wing
  return next
}

export function summarizeMagazine(row: Magazine): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isMagazine(value: unknown): value is Magazine {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Magazine).id === 'string'
}

export function sortMagazines(rows: Magazine[]): Magazine[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function cloneMagazine(row: Magazine): Magazine {
  return { ...row }
}

export function idsOfMagazines(rows: Magazine[]): string[] {
  return rows.map(row => row.id)
}

export function blankMagazineInput(): MagazineInput {
  return {}
}

export function hasId(row: Magazine, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Magazine, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
