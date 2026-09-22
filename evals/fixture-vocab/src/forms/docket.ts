import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Docket = {
  id: string
  createdAt: number
  updatedAt: number
  principalId: string
  minor: number
  phase: string
}

export type DocketInput = {
  principalId?: string
  minor?: number
  phase?: string
}

export const DOCKET_PREFIX = 'dck'

export function makeDocket(input: DocketInput = {}): Docket {
  const at = now()
  return {
    id: nextId('dck'),
    createdAt: at,
    updatedAt: at,
    principalId: input.principalId ?? 'prn_1',
    minor: input.minor ?? 0,
    phase: input.phase ?? 'open',
  }
}

export function touchDocket(row: Docket, patch: DocketInput = {}): Docket {
  const next = { ...row, updatedAt: now() }
  if (patch.principalId !== undefined) next.principalId = patch.principalId
  if (patch.minor !== undefined) next.minor = patch.minor
  if (patch.phase !== undefined) next.phase = patch.phase
  return next
}

export function summarizeDocket(row: Docket): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isDocket(value: unknown): value is Docket {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Docket).id === 'string'
}

export function sortDockets(rows: Docket[]): Docket[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function cloneDocket(row: Docket): Docket {
  return { ...row }
}

export function idsOfDockets(rows: Docket[]): string[] {
  return rows.map(row => row.id)
}

export function blankDocketInput(): DocketInput {
  return {}
}

export function hasId(row: Docket, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Docket, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
