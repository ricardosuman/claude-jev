import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as berths from '../stewards/berth'
import type { BerthInput } from '../forms/berth'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(berths.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = berths.get(vault, id)
  if (!row) throw notFound('berth')
  return json(row)
}

export function mint(vault: Vault, input: BerthInput): Result {
  return minted(berths.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: BerthInput): Result {
  return json(berths.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  berths.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: berths.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: berths.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(berths.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = berths.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(berths.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}
