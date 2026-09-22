import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makeIndenture, sortIndentures, touchIndenture, type Indenture, type IndentureInput } from '../forms/indenture'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Indenture> {
  const { folio, span } = parseFolio(query)
  return slice(sortIndentures(all(vault.indentures)), folio, span)
}

export function get(vault: Vault, id: string): Indenture | undefined {
  return vault.indentures.get(id)
}

export function require(vault: Vault, id: string): Indenture {
  const row = get(vault, id)
  if (!row) throw notFound('indenture')
  return row
}


export function mint(vault: Vault, input: IndentureInput): Indenture {
  const row = makeIndenture(input)
  return put(vault.indentures, row)
}

export function revise(vault: Vault, id: string, patch: IndentureInput): Indenture {
  const row = require(vault, id)
  const next = touchIndenture(row, patch)
  info('indenture.revise', { id })
  return put(vault.indentures, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.indentures.delete(id)) throw notFound('indenture')
}

export function count(vault: Vault): number {
  return vault.indentures.size
}

export function sieve(vault: Vault, pred: (row: Indenture) => boolean): Indenture[] {
  return all(vault.indentures).filter(pred)
}
