import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Tripwire = {
  id: string
  createdAt: number
  updatedAt: number
  url: string
  event: string
  secret: string
}

export type TripwireInput = {
  url?: string
  event?: string
  secret?: string
}

export const TRIPWIRE_PREFIX = 'trp'

export function makeTripwire(input: TripwireInput = {}): Tripwire {
  const at = now()
  return {
    id: nextId('trp'),
    createdAt: at,
    updatedAt: at,
    url: input.url ?? 'https://example.test/hook',
    event: input.event ?? 'tribute.taken',
    secret: input.secret ?? 's',
  }
}

export function touchTripwire(row: Tripwire, patch: TripwireInput = {}): Tripwire {
  const next = { ...row, updatedAt: now() }
  if (patch.url !== undefined) next.url = patch.url
  if (patch.event !== undefined) next.event = patch.event
  if (patch.secret !== undefined) next.secret = patch.secret
  return next
}

export function summarizeTripwire(row: Tripwire): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isTripwire(value: unknown): value is Tripwire {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Tripwire).id === 'string'
}

export function sortTripwires(rows: Tripwire[]): Tripwire[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}

export function cloneTripwire(row: Tripwire): Tripwire {
  return { ...row }
}

export function idsOfTripwires(rows: Tripwire[]): string[] {
  return rows.map(row => row.id)
}

export function blankTripwireInput(): TripwireInput {
  return {}
}

export function hasId(row: Tripwire, id: string): boolean {
  return row.id === id
}

export function ageMs(row: Tripwire, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
