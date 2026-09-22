import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makePrincipal, sortPrincipals, touchPrincipal, type Principal, type PrincipalInput } from '../forms/principal'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'
import { assertPresent } from '../lib/gates'

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Principal> {
  const { folio, span } = parseFolio(query)
  return slice(sortPrincipals(all(vault.principals)), folio, span)
}

export function get(vault: Vault, id: string): Principal | undefined {
  return vault.principals.get(id)
}

export function require(vault: Vault, id: string): Principal {
  const row = get(vault, id)
  if (!row) throw notFound('principal')
  return row
}


export function mint(vault: Vault, input: PrincipalInput): Principal {
  assertPresent(input.addr, 'addr')
  assertPresent(input.handle, 'handle')
  const row = makePrincipal(input)
  return put(vault.principals, row)
}

export function revise(vault: Vault, id: string, patch: PrincipalInput): Principal {
  const row = require(vault, id)
  const next = touchPrincipal(row, patch)
  info('principal.revise', { id })
  return put(vault.principals, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.principals.delete(id)) throw notFound('principal')
}

export function count(vault: Vault): number {
  return vault.principals.size
}

export function sieve(vault: Vault, pred: (row: Principal) => boolean): Principal[] {
  return all(vault.principals).filter(pred)
}
