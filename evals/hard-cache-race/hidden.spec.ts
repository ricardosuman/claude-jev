import { expect, test } from 'bun:test'
import { LoadingCache } from './cache'
import { profileService } from './profiles'

// a loader whose calls resolve only when the test says so
function manual() {
  const calls: { key: string; resolve: (v: string) => void; reject: (e: Error) => void }[] = []
  const load = (key: string) => new Promise<string>((resolve, reject) => calls.push({ key, resolve, reject }))
  return { calls, load }
}
const tick = () => new Promise(r => setTimeout(r, 0))

test('concurrent gets share one load', async () => {
  const m = manual()
  const cache = new LoadingCache(m.load)
  const a = cache.get('a'), b = cache.get('a')
  await tick()
  expect(m.calls.length).toBe(1)
  m.calls[0]!.resolve('v1')
  expect(await a).toBe('v1')
  expect(await b).toBe('v1')
})

test('a failed load is shared, then retried', async () => {
  const m = manual()
  const cache = new LoadingCache(m.load)
  const both = Promise.allSettled([cache.get('a'), cache.get('a')])
  await tick()
  expect(m.calls.length).toBe(1)
  m.calls[0]!.reject(new Error('down'))
  for (const r of await both) expect(r.status === 'rejected' && r.reason.message).toBe('down')
  const c = cache.get('a')
  await tick()
  expect(m.calls.length).toBe(2)
  m.calls[1]!.resolve('v2')
  expect(await c).toBe('v2')
})

test('a load that started before invalidate is not cached', async () => {
  const m = manual()
  const cache = new LoadingCache(m.load)
  cache.get('a').catch(() => {})
  await tick()
  cache.invalidate('a')
  m.calls[0]!.resolve('old')
  await tick()
  const next = cache.get('a')
  await tick()
  expect(m.calls.length).toBe(2)
  m.calls[1]!.resolve('new')
  expect(await next).toBe('new')
  expect(await cache.get('a')).toBe('new')
})

test('a get after invalidate does not join the stale load', async () => {
  const m = manual()
  const cache = new LoadingCache(m.load)
  cache.get('a').catch(() => {})
  await tick()
  cache.invalidate('a')
  const fresh = cache.get('a')
  await tick()
  expect(m.calls.length).toBe(2)
  m.calls[0]!.resolve('old') // the stale load settles first
  await tick()
  const joined = cache.get('a') // must share the fresh load, not start a third
  await tick()
  expect(m.calls.length).toBe(2)
  m.calls[1]!.resolve('new')
  expect(await fresh).toBe('new')
  expect(await joined).toBe('new')
  expect(await cache.get('a')).toBe('new')
})

test('a profile edited during a read is not served stale', async () => {
  const db = new Map([['u1', { id: 'u1', name: 'Ann' }]])
  const profiles = profileService(db)
  const reading = profiles.get('u1')
  await profiles.update('u1', 'Anna')
  await reading
  expect((await profiles.get('u1')).name).toBe('Anna')
})
