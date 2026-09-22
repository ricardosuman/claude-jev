import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Indenture = {
  id: string
  createdAt: number
  updatedAt: number
  principalId: string
  phase: string
  minor: number
}

export type IndentureInput = {
  principalId?: string
  phase?: string
  minor?: number
}

export const INDENTURE_PREFIX = 'ind'

export function makeIndenture(input: IndentureInput = {}): Indenture {
  const at = now()
  return {
    id: nextId('ind'),
    createdAt: at,
    updatedAt: at,
    principalId: input.principalId ?? 'prn_1',
    phase: input.phase ?? 'open',
    minor: input.minor ?? 0,
  }
}

export function touchIndenture(row: Indenture, patch: IndentureInput = {}): Indenture {
  const next = { ...row, updatedAt: now() }
  if (patch.principalId !== undefined) next.principalId = patch.principalId
  if (patch.phase !== undefined) next.phase = patch.phase
  if (patch.minor !== undefined) next.minor = patch.minor
  return next
}

export function summarizeIndenture(row: Indenture): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isIndenture(value: unknown): value is Indenture {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Indenture).id === 'string'
}

export function sortIndentures(rows: Indenture[]): Indenture[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function cloneIndenture(row: Indenture): Indenture {
  return { ...row }
}

export function idsOfIndentures(rows: Indenture[]): string[] {
  return rows.map(row => row.id)
}

export function blankIndentureInput(): IndentureInput {
  return {}
}

export function hasId(row: Indenture, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Indenture, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
