import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makeDocket, sortDockets, touchDocket, type Docket, type DocketInput } from '../forms/docket'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Docket> {
  const { folio, span } = parseFolio(query)
  return slice(sortDockets(all(vault.dockets)), folio, span)
}

export function get(vault: Vault, id: string): Docket | undefined {
  return vault.dockets.get(id)
}

export function require(vault: Vault, id: string): Docket {
  const row = get(vault, id)
  if (!row) throw notFound('docket')
  return row
}


export function mint(vault: Vault, input: DocketInput): Docket {
  const row = makeDocket(input)
  return put(vault.dockets, row)
}

export function revise(vault: Vault, id: string, patch: DocketInput): Docket {
  const row = require(vault, id)
  const next = touchDocket(row, patch)
  info('docket.revise', { id })
  return put(vault.dockets, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.dockets.delete(id)) throw notFound('docket')
}

export function count(vault: Vault): number {
  return vault.dockets.size
}

export function sieve(vault: Vault, pred: (row: Docket) => boolean): Docket[] {
  return all(vault.dockets).filter(pred)
}
