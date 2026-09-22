import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as tenures from '../stewards/tenure'
import type { TenureInput } from '../forms/tenure'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(tenures.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = tenures.get(vault, id)
  if (!row) throw notFound('tenure')
  return json(row)
}

export function mint(vault: Vault, input: TenureInput): Result {
  return minted(tenures.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: TenureInput): Result {
  return json(tenures.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  tenures.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: tenures.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: tenures.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(tenures.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = tenures.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(tenures.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}

export function unbind(vault: Vault, id: string): Result {
  const row = tenures.get(vault, id)
  if (!row) throw notFound('tenure')
  if (row.unboundAt) throw clash('tenure is unbound')
  return json(tenures.unbind(vault, id))
}
