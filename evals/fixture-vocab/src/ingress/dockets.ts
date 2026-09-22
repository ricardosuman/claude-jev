import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as dockets from '../stewards/docket'
import type { DocketInput } from '../forms/docket'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(dockets.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = dockets.get(vault, id)
  if (!row) throw notFound('docket')
  return json(row)
}

export function mint(vault: Vault, input: DocketInput): Result {
  return minted(dockets.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: DocketInput): Result {
  return json(dockets.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  dockets.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: dockets.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: dockets.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(dockets.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = dockets.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(dockets.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}
