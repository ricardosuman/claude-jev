import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makeMagazine, sortMagazines, touchMagazine, type Magazine, type MagazineInput } from '../forms/magazine'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Magazine> {
  const { folio, span } = parseFolio(query)
  return slice(sortMagazines(all(vault.magazines)), folio, span)
}

export function get(vault: Vault, id: string): Magazine | undefined {
  return vault.magazines.get(id)
}

export function require(vault: Vault, id: string): Magazine {
  const row = get(vault, id)
  if (!row) throw notFound('magazine')
  return row
}


export function mint(vault: Vault, input: MagazineInput): Magazine {
  const row = makeMagazine(input)
  return put(vault.magazines, row)
}

export function revise(vault: Vault, id: string, patch: MagazineInput): Magazine {
  const row = require(vault, id)
  const next = touchMagazine(row, patch)
  info('magazine.revise', { id })
  return put(vault.magazines, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.magazines.delete(id)) throw notFound('magazine')
}

export function count(vault: Vault): number {
  return vault.magazines.size
}

export function sieve(vault: Vault, pred: (row: Magazine) => boolean): Magazine[] {
  return all(vault.magazines).filter(pred)
}
