import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as tripwires from '../stewards/tripwire'
import type { TripwireInput } from '../forms/tripwire'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(tripwires.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = tripwires.get(vault, id)
  if (!row) throw notFound('tripwire')
  return json(row)
}

export function mint(vault: Vault, input: TripwireInput): Result {
  return minted(tripwires.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: TripwireInput): Result {
  return json(tripwires.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  tripwires.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: tripwires.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: tripwires.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(tripwires.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = tripwires.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(tripwires.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}
