import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makeBulletin, sortBulletins, touchBulletin, type Bulletin, type BulletinInput } from '../forms/bulletin'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Bulletin> {
  const { folio, span } = parseFolio(query)
  return slice(sortBulletins(all(vault.bulletins)), folio, span)
}

export function get(vault: Vault, id: string): Bulletin | undefined {
  return vault.bulletins.get(id)
}

export function require(vault: Vault, id: string): Bulletin {
  const row = get(vault, id)
  if (!row) throw notFound('bulletin')
  return row
}


export function mint(vault: Vault, input: BulletinInput): Bulletin {
  const row = makeBulletin(input)
  return put(vault.bulletins, row)
}

export function revise(vault: Vault, id: string, patch: BulletinInput): Bulletin {
  const row = require(vault, id)
  const next = touchBulletin(row, patch)
  info('bulletin.revise', { id })
  return put(vault.bulletins, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.bulletins.delete(id)) throw notFound('bulletin')
}

export function count(vault: Vault): number {
  return vault.bulletins.size
}

export function sieve(vault: Vault, pred: (row: Bulletin) => boolean): Bulletin[] {
  return all(vault.bulletins).filter(pred)
}
