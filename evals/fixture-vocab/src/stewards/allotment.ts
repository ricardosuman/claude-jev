import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { makeAllotment, sortAllotments, touchAllotment, type Allotment, type AllotmentInput } from '../forms/allotment'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'
import { now } from '../lib/clock'
import { assertPresent } from '../lib/gates'

export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<Allotment> {
  const { folio, span } = parseFolio(query)
  return slice(sortAllotments(all(vault.allotments)), folio, span)
}

export function get(vault: Vault, id: string): Allotment | undefined {
  return vault.allotments.get(id)
}

export function require(vault: Vault, id: string): Allotment {
  const row = get(vault, id)
  if (!row) throw notFound('allotment')
  return row
}


export function mint(vault: Vault, input: AllotmentInput): Allotment {
  assertPresent(input.principalId, 'principalId')
  assertPresent(input.berthId, 'berthId')
  const blazon = input.blazon && input.blazon.length > 0 ? input.blazon : 'ABCDEFGH'
  const row = makeAllotment({ ...input, phase: input.phase ?? 'held', blazon, unwoundAt: null })
  return put(vault.allotments, row)
}

export function unwind(vault: Vault, id: string): Allotment {
  const row = get(vault, id)
  if (!row) throw notFound('allotment')
  return put(vault.allotments, touchAllotment(row, { phase: 'unwound', unwoundAt: now() }))
}

export function revise(vault: Vault, id: string, patch: AllotmentInput): Allotment {
  const row = require(vault, id)
  const next = touchAllotment(row, patch)
  info('allotment.revise', { id })
  return put(vault.allotments, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.allotments.delete(id)) throw notFound('allotment')
}

export function count(vault: Vault): number {
  return vault.allotments.size
}

export function sieve(vault: Vault, pred: (row: Allotment) => boolean): Allotment[] {
  return all(vault.allotments).filter(pred)
}
