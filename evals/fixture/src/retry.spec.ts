import { expect, test } from 'bun:test'
import { retry } from './retry'

test('retry succeeds on the last attempt', async () => {
  let calls = 0
  const value = await retry(async () => {
    calls++
    if (calls < 3) throw new Error('flaky')
    return 'ok'
  })
  expect(value).toBe('ok')
  expect(calls).toBe(3)
})
