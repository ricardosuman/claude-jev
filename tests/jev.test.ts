import type { HttpInit, HttpResponse } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { ask, LEDGER_KEY, type JevHost, type Question } from '../hooks/jev'

const QUESTIONS: Record<string, Question> = {
  tier: { type: 'choice', instructions: 'Which tier?', criteria: { lookup: 'read-only', debug: 'fix a bug' } },
}

/**
 * The live API's answer (jev-1.13.0) to QUESTIONS.
 */
const BODY = {
  model: 'jev-1.13.0',
  answers: {
    tier: { type: 'choice', choice: 'lookup', confidence: 0.93, probabilities: { lookup: 0.95, debug: 0.05 } },
  },
  usage: { input_tokens: 399, output_tokens: 70 },
}

/**
 * A host answering from memory: `fetch` as given, the key when given, a clock
 * that moves only by `tick`, and a store read back through `stored`.
 *
 * `ask` reaches `$` only through a JevHost (the runtime refuses `$` across an
 * import, and an inline test plugin is loaded alone), so this is its engine.
 */
function hostWith(fetch: JevHost['fetch'], key?: string) {
  let now = 1000
  const store = new Map<string, unknown>()
  const sleeps: { at: number; wake: () => void }[] = []
  const sent: { url: string; init: HttpInit }[] = []
  const host: JevHost = {
    apiKey: async () => key,
    now: async () => now,
    sleep: (ms, signal) =>
      new Promise((resolve, reject) => {
        sleeps.push({ at: now + ms, wake: resolve })
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }),
    fetch: (url, init) => {
      sent.push({ url, init })

      return fetch(url, init)
    },
    storeGet: async k => store.get(k),
    storeSet: async (k, value) => {
      store.set(k, structuredClone(value))
    },
  }

  return {
    host,
    sent,
    tick: (ms: number) => {
      now += ms
      sleeps.filter(s => s.at <= now).forEach(s => s.wake())
    },
    // the ledger row is written after ask resolves: let the microtasks drain
    stored: async () => {
      for (let i = 0; i < 20; i++) await Promise.resolve()

      return store.get(LEDGER_KEY)
    },
  }
}

const ok = (text: string): Promise<HttpResponse> =>
  Promise.resolve({ status: 200, ok: true, headers: {}, text })

describe('jev', () => {
  test('a 2xx answer is parsed and leaves an ok ledger row', async () => {
    const world = hostWith(() => ok(JSON.stringify(BODY)), 'k')

    expect(await ask(world.host, 'test', 'state', QUESTIONS, 1500)).toEqual(BODY.answers)
    expect(world.sent).toEqual([
      {
        url: 'https://api.typesafe.ai/v1/systemone',
        init: {
          method: 'POST',
          headers: { Authorization: 'Bearer k', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'jev-latest', state: 'state', questions: QUESTIONS }),
        },
      },
    ])
    expect(await world.stored()).toEqual([
      { at: 1000, purpose: 'test', keys: ['tier'], ok: true, latencyMs: 0, usage: BODY.usage, answers: BODY.answers },
    ])
  })

  test('without a key it answers null and fetches nothing', async () => {
    const world = hostWith(() => ok(JSON.stringify(BODY)))

    expect(await ask(world.host, 'test', 's', QUESTIONS, 1500)).toBeNull()
    expect(world.sent).toEqual([])
    expect(await world.stored()).toMatchObject([{ ok: false, keys: ['tier'] }])
  })

  for (const [name, fetch] of [
    ['a thrown fetch', () => Promise.reject(new Error('offline'))],
    ['a non-2xx', () => Promise.resolve({ status: 500, ok: false, headers: {}, text: 'boom' })],
    ['an unreadable body', () => ok('not json')],
    ['a body without answers', () => ok('null')],
  ] as const) {
    test(`${name} answers null and leaves a failed row`, async () => {
      const world = hostWith(fetch, 'k')

      expect(await ask(world.host, 'test', 's', QUESTIONS, 1500)).toBeNull()
      expect(await world.stored()).toMatchObject([{ ok: false }])
    })
  }

  test('a fetch past timeoutMs answers null at the timeout', async () => {
    const world = hostWith(() => new Promise<HttpResponse>(() => undefined), 'k')
    let answer: unknown = 'pending'

    void ask(world.host, 'test', 's', QUESTIONS, 1500).then(a => {
      answer = a
    })
    await world.stored()
    world.tick(1499)
    await world.stored()
    expect(answer).toBe('pending')
    world.tick(1)
    expect(await world.stored()).toMatchObject([{ ok: false, latencyMs: 1500 }])
    expect(answer).toBeNull()
  })
})
