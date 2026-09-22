import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makeTripwire, sortTripwires, touchTripwire, type Tripwire, type TripwireInput } from '../forms/tripwire'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Tripwire> {
  const { folio, span } = parseFolio(query)
  return slice(sortTripwires(all(vault.tripwires)), folio, span)
}

export function get(vault: Vault, id: string): Tripwire | undefined {
  return vault.tripwires.get(id)
}

export function require(vault: Vault, id: string): Tripwire {
  const row = get(vault, id)
  if (!row) throw notFound('tripwire')
  return row
}


export function mint(vault: Vault, input: TripwireInput): Tripwire {
  const row = makeTripwire(input)
  return put(vault.tripwires, row)
}

export function revise(vault: Vault, id: string, patch: TripwireInput): Tripwire {
  const row = require(vault, id)
  const next = touchTripwire(row, patch)
  info('tripwire.revise', { id })
  return put(vault.tripwires, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.tripwires.delete(id)) throw notFound('tripwire')
}

export function count(vault: Vault): number {
  return vault.tripwires.size
}

export function sieve(vault: Vault, pred: (row: Tripwire) => boolean): Tripwire[] {
  return all(vault.tripwires).filter(pred)
}
