import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as holdfasts from '../stewards/holdfast'
import type { HoldfastInput } from '../forms/holdfast'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(holdfasts.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = holdfasts.get(vault, id)
  if (!row) throw notFound('holdfast')
  return json(row)
}

export function mint(vault: Vault, input: HoldfastInput): Result {
  return minted(holdfasts.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: HoldfastInput): Result {
  return json(holdfasts.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  holdfasts.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: holdfasts.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: holdfasts.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(holdfasts.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = holdfasts.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(holdfasts.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}
