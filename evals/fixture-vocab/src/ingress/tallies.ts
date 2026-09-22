import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as tallies from '../stewards/tally'
import type { TallyInput } from '../forms/tally'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(tallies.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = tallies.get(vault, id)
  if (!row) throw notFound('tally')
  return json(row)
}

export function mint(vault: Vault, input: TallyInput): Result {
  return minted(tallies.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: TallyInput): Result {
  return json(tallies.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  tallies.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: tallies.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: tallies.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(tallies.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = tallies.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(tallies.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}
