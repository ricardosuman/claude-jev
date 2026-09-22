import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as allotments from '../stewards/allotment'
import type { AllotmentInput } from '../forms/allotment'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(allotments.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = allotments.get(vault, id)
  if (!row) throw notFound('allotment')
  return json(row)
}

export function mint(vault: Vault, input: AllotmentInput): Result {
  return minted(allotments.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: AllotmentInput): Result {
  return json(allotments.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  allotments.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: allotments.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: allotments.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(allotments.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = allotments.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(allotments.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}

export function unwind(vault: Vault, id: string): Result {
  const row = allotments.get(vault, id)
  if (!row) throw notFound('allotment')
  if (row.unwoundAt) throw clash('allotment is unwound')
  return json(allotments.unwind(vault, id))
}

export function touch(vault: Vault, id: string): Result {
  const row = allotments.require(vault, id)
  return json(row)
}
