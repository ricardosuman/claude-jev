import { expect, test } from 'bun:test'
import { LruCache } from './lru'

test('evicts the least recently used entry', () => {
  const cache = new LruCache<string, number>(2)
  cache.set('a', 1)
  cache.set('b', 2)
  cache.get('a')
  cache.set('c', 3)
  expect(cache.keys()).toEqual(['a', 'c'])
})

test('entries expire after ttlMs', () => {
  let now = 0
  const cache = new LruCache<string, number>(10, { ttlMs: 100, now: () => now })
  cache.set('a', 1)
  now = 100
  expect(cache.get('a')).toBeUndefined()
})
