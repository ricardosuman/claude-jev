import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makeTally, sortTallys, touchTally, type Tally, type TallyInput } from '../forms/tally'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Tally> {
  const { folio, span } = parseFolio(query)
  return slice(sortTallys(all(vault.tallies)), folio, span)
}

export function get(vault: Vault, id: string): Tally | undefined {
  return vault.tallies.get(id)
}

export function require(vault: Vault, id: string): Tally {
  const row = get(vault, id)
  if (!row) throw notFound('tally')
  return row
}


export function mint(vault: Vault, input: TallyInput): Tally {
  const row = makeTally(input)
  return put(vault.tallies, row)
}

export function revise(vault: Vault, id: string, patch: TallyInput): Tally {
  const row = require(vault, id)
  const next = touchTally(row, patch)
  info('tally.revise', { id })
  return put(vault.tallies, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.tallies.delete(id)) throw notFound('tally')
}

export function count(vault: Vault): number {
  return vault.tallies.size
}

export function sieve(vault: Vault, pred: (row: Tally) => boolean): Tally[] {
  return all(vault.tallies).filter(pred)
}
