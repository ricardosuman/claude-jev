import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as principals from '../stewards/principal'
import type { PrincipalInput } from '../forms/principal'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(principals.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = principals.get(vault, id)
  if (!row) throw notFound('principal')
  return json(row)
}

export function mint(vault: Vault, input: PrincipalInput): Result {
  return minted(principals.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: PrincipalInput): Result {
  return json(principals.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  principals.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: principals.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: principals.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(principals.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = principals.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(principals.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}
