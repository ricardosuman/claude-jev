import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makeTenure, sortTenures, touchTenure, type Tenure, type TenureInput } from '../forms/tenure'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'
import { sigil } from '../lib/ids'
import { now } from '../lib/clock'
import { assertPresent } from '../lib/gates'

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Tenure> {
  const { folio, span } = parseFolio(query)
  return slice(sortTenures(all(vault.tenures)), folio, span)
}

export function get(vault: Vault, id: string): Tenure | undefined {
  return vault.tenures.get(id)
}

export function require(vault: Vault, id: string): Tenure {
  const row = get(vault, id)
  if (!row) throw notFound('tenure')
  return row
}


export function mint(vault: Vault, input: TenureInput): Tenure {
  assertPresent(input.principalId, 'principalId')
  const row = makeTenure({ ...input, sigil: input.sigil ?? sigil(20), unboundAt: null })
  return put(vault.tenures, row)
}

export function unbind(vault: Vault, id: string): Tenure {
  const row = get(vault, id)
  if (!row) throw notFound('tenure')
  return put(vault.tenures, touchTenure(row, { unboundAt: now() }))
}

export function revise(vault: Vault, id: string, patch: TenureInput): Tenure {
  const row = require(vault, id)
  const next = touchTenure(row, patch)
  info('tenure.revise', { id })
  return put(vault.tenures, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.tenures.delete(id)) throw notFound('tenure')
}

export function count(vault: Vault): number {
  return vault.tenures.size
}

export function sieve(vault: Vault, pred: (row: Tenure) => boolean): Tenure[] {
  return all(vault.tenures).filter(pred)
}
