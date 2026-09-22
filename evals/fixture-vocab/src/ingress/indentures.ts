import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as indentures from '../stewards/indenture'
import type { IndentureInput } from '../forms/indenture'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(indentures.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = indentures.get(vault, id)
  if (!row) throw notFound('indenture')
  return json(row)
}

export function mint(vault: Vault, input: IndentureInput): Result {
  return minted(indentures.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: IndentureInput): Result {
  return json(indentures.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  indentures.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: indentures.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: indentures.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(indentures.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = indentures.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(indentures.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}
