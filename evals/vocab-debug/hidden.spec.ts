import { expect, test } from 'bun:test'
import { AppError } from './lib/errors'
import { createVault } from './lib/vault'
import { unwind } from './ingress/allotments'
import { mint, get } from './stewards/allotment'

test('unwind marks an active allotment', () => {
  const vault = createVault()
  const row = mint(vault, { principalId: 'prn_1', berthId: 'brt_1' })
  const res = unwind(vault, row.id)
  expect(res.status).toBe(200)
  expect(get(vault, row.id)!.unwoundAt).not.toBeNull()
})

test('unwind of a missing allotment is 404', () => {
  const vault = createVault()
  expect(() => unwind(vault, 'alt_nope')).toThrow(AppError)
  try {
    unwind(vault, 'alt_nope')
  } catch (err) {
    expect((err as AppError).status).toBe(404)
  }
})

test('unwind of an already unwound allotment is 409', () => {
  const vault = createVault()
  const row = mint(vault, { principalId: 'prn_1', berthId: 'brt_1' })
  unwind(vault, row.id)
  try {
    unwind(vault, row.id)
    throw new Error('expected clash')
  } catch (err) {
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).status).toBe(409)
  }
})
