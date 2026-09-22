import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as tributes from '../stewards/tribute'
import type { TributeInput } from '../forms/tribute'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(tributes.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = tributes.get(vault, id)
  if (!row) throw notFound('tribute')
  return json(row)
}

export function mint(vault: Vault, input: TributeInput): Result {
  return minted(tributes.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: TributeInput): Result {
  return json(tributes.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  tributes.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: tributes.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: tributes.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(tributes.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = tributes.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(tributes.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}
