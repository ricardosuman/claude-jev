import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makeBerth, sortBerths, touchBerth, type Berth, type BerthInput } from '../forms/berth'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Berth> {
  const { folio, span } = parseFolio(query)
  return slice(sortBerths(all(vault.berths)), folio, span)
}

export function get(vault: Vault, id: string): Berth | undefined {
  return vault.berths.get(id)
}

export function require(vault: Vault, id: string): Berth {
  const row = get(vault, id)
  if (!row) throw notFound('berth')
  return row
}


export function mint(vault: Vault, input: BerthInput): Berth {
  const row = makeBerth(input)
  return put(vault.berths, row)
}

export function revise(vault: Vault, id: string, patch: BerthInput): Berth {
  const row = require(vault, id)
  const next = touchBerth(row, patch)
  info('berth.revise', { id })
  return put(vault.berths, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.berths.delete(id)) throw notFound('berth')
}

export function count(vault: Vault): number {
  return vault.berths.size
}

export function sieve(vault: Vault, pred: (row: Berth) => boolean): Berth[] {
  return all(vault.berths).filter(pred)
}
