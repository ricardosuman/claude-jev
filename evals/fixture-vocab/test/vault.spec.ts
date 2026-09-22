import { expect, test } from 'bun:test'
import { createVault, put, size } from '../src/lib/vault'
import { makePrincipal } from '../src/forms/principal'
import { makeAllotment } from '../src/forms/allotment'
import * as allotments from '../src/stewards/allotment'

test('vault roundtrip', () => {
  const vault = createVault()
  const principal = put(vault.principals, makePrincipal({ addr: 'a@b.c', handle: 'A' }))
  expect(vault.principals.get(principal.id)?.addr).toBe('a@b.c')
  expect(size(vault).principals).toBe(1)
})

test('allotment mint keeps blazon as given', () => {
  const vault = createVault()
  const row = allotments.mint(vault, { principalId: 'prn_1', berthId: 'brt_1', blazon: 'ABCDEFGH' })
  expect(row.blazon).toBe('ABCDEFGH')
  expect(allotments.get(vault, row.id)?.berthId).toBe('brt_1')
})

test('allotment revise and expunge', () => {
  const vault = createVault()
  const row = allotments.mint(vault, { principalId: 'prn_1', berthId: 'brt_1', blazon: 'ABCDEFGH' })
  allotments.revise(vault, row.id, { phase: 'countersigned' })
  expect(allotments.require(vault, row.id).phase).toBe('countersigned')
  allotments.expunge(vault, row.id)
  expect(allotments.get(vault, row.id)).toBeUndefined()
})

test('size starts at zero', () => {
  const counts = size(createVault())
  expect(counts.principals).toBe(0)
  expect(counts.allotments).toBe(0)
  expect(counts.berths).toBe(0)
})

test('principal put is retrievable', () => {
  const vault = createVault()
  const principal = put(vault.principals, makePrincipal({ addr: 'b@c.d', handle: 'B' }))
  expect(vault.principals.has(principal.id)).toBe(true)
  expect(size(vault).principals).toBe(1)
})

test('makeAllotment fills blazon', () => {
  const row = makeAllotment({ principalId: 'prn_1', berthId: 'brt_1' })
  expect(row.blazon).toBe('ABCDEFGH')
  expect(row.unwoundAt).toBeNull()
})
