import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as magazines from '../stewards/magazine'
import type { MagazineInput } from '../forms/magazine'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(magazines.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = magazines.get(vault, id)
  if (!row) throw notFound('magazine')
  return json(row)
}

export function mint(vault: Vault, input: MagazineInput): Result {
  return minted(magazines.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: MagazineInput): Result {
  return json(magazines.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  magazines.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: magazines.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: magazines.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(magazines.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = magazines.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(magazines.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}
