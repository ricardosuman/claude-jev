import { expect, test } from 'bun:test'
import { LoadingCache } from './cache'

test('caches loaded values', async () => {
  let loads = 0
  const cache = new LoadingCache(async key => `${key}:${++loads}`)
  expect(await cache.get('a')).toBe('a:1')
  expect(await cache.get('a')).toBe('a:1')
})

test('invalidate forces a reload', async () => {
  let loads = 0
  const cache = new LoadingCache(async key => `${key}:${++loads}`)
  await cache.get('a')
  cache.invalidate('a')
  expect(await cache.get('a')).toBe('a:2')
})
