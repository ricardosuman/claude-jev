import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makeHoldfast, sortHoldfasts, touchHoldfast, type Holdfast, type HoldfastInput } from '../forms/holdfast'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Holdfast> {
  const { folio, span } = parseFolio(query)
  return slice(sortHoldfasts(all(vault.holdfasts)), folio, span)
}

export function get(vault: Vault, id: string): Holdfast | undefined {
  return vault.holdfasts.get(id)
}

export function require(vault: Vault, id: string): Holdfast {
  const row = get(vault, id)
  if (!row) throw notFound('holdfast')
  return row
}


export function mint(vault: Vault, input: HoldfastInput): Holdfast {
  const row = makeHoldfast(input)
  return put(vault.holdfasts, row)
}

export function revise(vault: Vault, id: string, patch: HoldfastInput): Holdfast {
  const row = require(vault, id)
  const next = touchHoldfast(row, patch)
  info('holdfast.revise', { id })
  return put(vault.holdfasts, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.holdfasts.delete(id)) throw notFound('holdfast')
}

export function count(vault: Vault): number {
  return vault.holdfasts.size
}

export function sieve(vault: Vault, pred: (row: Holdfast) => boolean): Holdfast[] {
  return all(vault.holdfasts).filter(pred)
}
