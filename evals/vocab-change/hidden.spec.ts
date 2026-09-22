import { expect, test } from 'bun:test'
import { AppError } from './lib/errors'
import { createVault } from './lib/vault'
import * as gates from './lib/gates'
import { mint } from './stewards/allotment'

test('gates exports a checker for eight latin caps', () => {
  const fns = Object.values(gates).filter((v): v is (s: string) => unknown => typeof v === 'function')
  const checker = fns.find(fn => {
    try {
      if (fn('ABCDEFGH') !== 'ABCDEFGH') return false
    } catch {
      return false
    }
    try {
      fn('nope')
      return false
    } catch {
      return true
    }
  })
  expect(checker).toBeTruthy()
  try {
    checker!('ABCDEFG')
    throw new Error('accepted short')
  } catch (err) {
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).status).toBe(400)
  }
  try {
    checker!('abcdefgh')
    throw new Error('accepted lower')
  } catch (err) {
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).status).toBe(400)
  }
  try {
    checker!('ABCD1234')
    throw new Error('accepted digits')
  } catch (err) {
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).status).toBe(400)
  }
})

test('mint rejects a bad blazon and accepts a good one', () => {
  const vault = createVault()
  try {
    mint(vault, { principalId: 'prn_1', berthId: 'brt_1', blazon: 'nope' })
    throw new Error('accepted bad blazon')
  } catch (err) {
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).status).toBe(400)
  }
  const row = mint(vault, { principalId: 'prn_1', berthId: 'brt_1', blazon: 'ABCDEFGH' })
  expect(row.blazon).toBe('ABCDEFGH')
})
