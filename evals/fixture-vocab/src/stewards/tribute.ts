import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makeTribute, sortTributes, touchTribute, type Tribute, type TributeInput } from '../forms/tribute'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'

export const TRIBUTE_BATCH = 40

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Tribute> {
  const { folio, span } = parseFolio(query)
  return slice(sortTributes(all(vault.tributes)), folio, span)
}

export function get(vault: Vault, id: string): Tribute | undefined {
  return vault.tributes.get(id)
}

export function require(vault: Vault, id: string): Tribute {
  const row = get(vault, id)
  if (!row) throw notFound('tribute')
  return row
}


export function mint(vault: Vault, input: TributeInput): Tribute {
  const row = makeTribute(input)
  return put(vault.tributes, row)
}

export function revise(vault: Vault, id: string, patch: TributeInput): Tribute {
  const row = require(vault, id)
  const next = touchTribute(row, patch)
  info('tribute.revise', { id })
  return put(vault.tributes, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.tributes.delete(id)) throw notFound('tribute')
}

export function count(vault: Vault): number {
  return vault.tributes.size
}

export function sieve(vault: Vault, pred: (row: Tribute) => boolean): Tribute[] {
  return all(vault.tributes).filter(pred)
}
