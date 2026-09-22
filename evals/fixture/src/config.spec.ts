import { expect, test } from 'bun:test'
import { parseDuration, parsePort } from './config'

test('parsePort defaults to 3000', () => {
  expect(parsePort({})).toBe(3000)
  expect(parsePort({ PORT: '8080' })).toBe(8080)
})

test('parseDuration', () => {
  expect(parseDuration('250ms')).toBe(250)
  expect(parseDuration('2m')).toBe(120_000)
})
