import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as bulletins from '../stewards/bulletin'
import type { BulletinInput } from '../forms/bulletin'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(bulletins.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = bulletins.get(vault, id)
  if (!row) throw notFound('bulletin')
  return json(row)
}

export function mint(vault: Vault, input: BulletinInput): Result {
  return minted(bulletins.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: BulletinInput): Result {
  return json(bulletins.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  bulletins.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: bulletins.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: bulletins.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(bulletins.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = bulletins.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(bulletins.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}
