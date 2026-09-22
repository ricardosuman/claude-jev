import { expect, test } from 'bun:test'
import { LruCache } from './lru'

function setup(capacity: number, ttlMs?: number) {
  let now = 0
  const evicted: string[] = []
  const cache = new LruCache<string, number>(capacity, { ttlMs, now: () => now, onEvict: (k, v, reason) => evicted.push(`${k}=${v}:${reason}`) })
  return { cache, evicted, at: (t: number) => (now = t) }
}

test('capacity evictions go least recently used first', () => {
  const { cache, evicted } = setup(3)
  for (const [k, v] of [['a', 1], ['b', 2], ['c', 3]] as const) cache.set(k, v)
  cache.get('a')
  cache.set('d', 4)
  cache.set('e', 5)
  expect(evicted).toEqual(['b=2:capacity', 'c=3:capacity'])
  expect(cache.keys()).toEqual(['a', 'd', 'e'])
})

test('set on an existing key replaces it silently and marks it used', () => {
  const { cache, evicted } = setup(2)
  cache.set('a', 1)
  cache.set('b', 2)
  cache.set('a', 10)
  expect(evicted).toEqual([])
  expect(cache.size).toBe(2)
  cache.set('c', 3)
  expect(evicted).toEqual(['b=2:capacity'])
  expect(cache.get('a')).toBe(10)
})

test('capacity 0 stores nothing', () => {
  const { cache, evicted } = setup(0)
  cache.set('a', 1)
  expect(cache.size).toBe(0)
  expect(cache.get('a')).toBeUndefined()
  expect(evicted).toEqual([])
})

test('peek does not mark an entry used, nor remove an expired one', () => {
  const { cache, evicted, at } = setup(2, 100)
  cache.set('a', 1)
  cache.set('b', 2)
  expect(cache.peek('a')).toBe(1)
  cache.set('c', 3)
  expect(evicted).toEqual(['a=1:capacity'])
  at(100)
  expect(cache.peek('b')).toBeUndefined()
  expect(cache.size).toBe(2)
  expect(evicted).toEqual(['a=1:capacity'])
  expect(cache.get('b')).toBeUndefined()
  expect(evicted).toEqual(['a=1:capacity', 'b=2:expired'])
  expect(cache.size).toBe(1)
})

test('expired entries count toward size until evicted, but not toward keys()', () => {
  const { cache, evicted, at } = setup(3, 100)
  cache.set('a', 1)
  at(50)
  cache.set('b', 2)
  at(120)
  expect(cache.size).toBe(2)
  expect(cache.keys()).toEqual(['b'])
  cache.set('c', 3)
  expect(cache.size).toBe(3)
  expect(evicted).toEqual([])
})

test('when full, expired entries make room before live ones, earliest expiry first', () => {
  const { cache, evicted, at } = setup(3, 100)
  cache.set('a', 1)
  at(10)
  cache.set('b', 2)
  at(20)
  cache.set('c', 3)
  at(30)
  cache.get('a') // least recently used is now b
  at(115) // a and b have expired, c has not
  cache.set('d', 4)
  expect(evicted).toEqual(['a=1:expired', 'b=2:expired'])
  expect(cache.keys()).toEqual(['c', 'd'])
  at(125)
  cache.set('e', 5)
  cache.set('f', 6)
  expect(evicted).toEqual(['a=1:expired', 'b=2:expired', 'c=3:expired'])
  cache.set('g', 7)
  expect(evicted).toEqual(['a=1:expired', 'b=2:expired', 'c=3:expired', 'd=4:capacity'])
})

test('set refreshes the ttl', () => {
  const { cache, at } = setup(2, 100)
  cache.set('a', 1)
  at(60)
  cache.set('a', 2)
  at(150)
  expect(cache.get('a')).toBe(2)
})

test('delete', () => {
  const { cache, evicted, at } = setup(3, 100)
  cache.set('a', 1)
  cache.set('b', 2)
  expect(cache.delete('a')).toBe(true)
  expect(cache.delete('a')).toBe(false)
  at(100)
  expect(cache.delete('b')).toBe(true)
  expect(evicted).toEqual(['a=1:deleted', 'b=2:deleted'])
  expect(cache.size).toBe(0)
})

test('large caches stay fast', () => {
  const cache = new LruCache<number, number>(50_000, { ttlMs: 60_000 })
  for (let i = 0; i < 50_000; i++) cache.set(i, i)
  const start = performance.now()
  let ops = 0
  for (; ops < 100_000 && performance.now() - start < 300; ops++) {
    cache.get((ops * 7919) % 50_000)
    cache.set(50_000 + ops, ops)
  }
  expect(ops).toBe(100_000) // 200k operations in under 300ms
  expect(cache.size).toBe(50_000)
})
