import type { HttpResponse, On, SessionCompactInput } from 'claude-code'
import { describe, expect, mock, test, type Engine } from 'claude-code/testing'

const PRESENTATION = { isFullscreen: false, columns: 80 }
const ON = { JEV_COMPONENTS: 'compact' }

/**
 * The world beneath the pause: env and key, a Jev answering each question with
 * `noul(instructions)` (throwing when that throws), the context at `percent`,
 * core recording each compaction (a plugin's one rejected with `rejectPlugin`),
 * Jev's answers held until `held` resolves, and a model that answers each step.
 */
function world(
  on: On,
  env: Record<string, string>,
  noul: (instructions: string) => unknown,
  { percent = 70, rejectPlugin = false, held = undefined as Promise<void> | undefined } = {},
) {
  const fetches: { questions: Record<string, { instructions: string }>; state: unknown }[] = []
  const compactions: SessionCompactInput[] = []
  const clock = mock.clock(on)
  mock.store(on)
  mock.env(on, { TYPESAFE_API_KEY: 'k', ...env })
  on('http.fetch', async ($, e) => {
    await held
    const body = JSON.parse(String(e.init?.body)) as (typeof fetches)[number]
    fetches.push(body)
    const keys = Object.keys(body.questions)
    const answers = Object.fromEntries(keys.map(key => [key, { type: 'noul', noul: noul(body.questions[key]!.instructions) }]))

    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ answers }) } satisfies HttpResponse }
  })
  on('session.usage', () => ({ value: { context: { tokens: percent * 2000, window: 200000, percent }, rateLimits: [] } }))
  on('session.compact', ($, e) => {
    if (rejectPlugin && isPlugin(e)) throw new Error('a turn is running')
    compactions.push(e)

    // the kit's $.session.compact() carries no transcript; the engine's fills it
    return { messages: e.messages ?? [{ role: 'user', text: 'summary', toolUses: [] }] }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))

  return { clock, fetches, compactions }
}

// the kit hands the plugin's own $.session.compact() to the test as {}: no trigger, no transcript
const isPlugin = (e: SessionCompactInput) => e.trigger === 'plugin' || e.trigger === undefined

async function ledgerOf($: Engine, clock: { settle: () => Promise<void> }) {
  await clock.settle()
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const json = await $.command.run({ command: 'jev', args: 'json', origin: { kind: 'composer' }, presentation: PRESENTATION })
  const summary = await $.command.run({ command: 'jev', args: 'text', origin: { kind: 'composer' }, presentation: PRESENTATION })

  return { rows: JSON.parse(json.text ?? '') as Record<string, unknown>[], summary: summary.text ?? '' }
}

describe('compact: the pause', () => {
  async function turns($: Engine, clock: { settle: () => Promise<void> }, n: number, from = 1) {
    for (let t = from; t < from + n; t++) {
      await $.turn.start({ turnId: `t${t}`, text: 'fix the build' })
      await $.turn.complete({ answer: 'done: the build passes', durationMs: 1, isAborted: false, turnId: `t${t}`, reason: 'answer' })
      await clock.settle()
    }
  }
  const pauseAt = (p: number) => (instructions: string) => (instructions.includes('natural pause') ? p : 0.1)
  const plugin = (w: { compactions: SessionCompactInput[] }) => w.compactions.filter(isPlugin)

  test('in the window, after the min turns, at p >= threshold: one compaction; the count starts again', async ($, on) => {
    const w = world(on, ON, pauseAt(0.9))

    await turns($, w.clock, 4)
    expect(w.fetches).toEqual([])
    expect(plugin(w)).toHaveLength(0)

    await turns($, w.clock, 1, 5)
    expect(plugin(w)).toHaveLength(1)
    expect(w.fetches[0]!.state).toEqual({ task: 'fix the build', answer: 'done: the build passes' })

    await turns($, w.clock, 4, 6)
    expect(plugin(w)).toHaveLength(1)

    const { rows } = await ledgerOf($, w.clock)
    expect(rows.filter(r => r.purpose === 'compact.pause')).toMatchObject([{ percent: 70, p: 0.9, fired: true }])
  })

  for (const percent of [59, 85]) {
    test(`at ${percent}% nothing is asked`, async ($, on) => {
      const w = world(on, ON, pauseAt(0.9), { percent })

      await turns($, w.clock, 6)

      expect(w.fetches).toEqual([])
      expect(plugin(w)).toHaveLength(0)
    })
  }

  test('under the threshold: asked, not compacted', async ($, on) => {
    const w = world(on, ON, pauseAt(0.5))

    await turns($, w.clock, 5)
    const { rows } = await ledgerOf($, w.clock)

    expect(plugin(w)).toHaveLength(0)
    expect(rows.filter(r => r.purpose === 'compact.pause')).toMatchObject([{ p: 0.5, fired: false }])
  })

  test('a Jev failure does nothing', async ($, on) => {
    const w = world(on, ON, () => {
      throw new Error('offline')
    })

    await turns($, w.clock, 5)

    expect(w.fetches).toHaveLength(1)
    expect(plugin(w)).toHaveLength(0)
  })

  test("a rejected $.session.compact is ignored and the turns go on", async ($, on) => {
    const w = world(on, ON, pauseAt(0.9), { rejectPlugin: true })

    await turns($, w.clock, 6)
    const { rows } = await ledgerOf($, w.clock)

    expect(plugin(w)).toHaveLength(0)
    expect(rows.filter(r => r.purpose === 'compact.pause')).toMatchObject([{ fired: false }, { fired: false }])
  })

  test('compact off: never asked', async ($, on) => {
    const w = world(on, {}, pauseAt(0.9))

    await turns($, w.clock, 6)

    expect(w.fetches).toEqual([])
  })

  test('overlapping turn ends while Jev is held: one ask, at most one compaction', async ($, on) => {
    let release!: () => void
    const w = world(on, ON, pauseAt(0.9), { held: new Promise<void>(resolve => (release = resolve)) })

    await turns($, w.clock, 4)
    for (const t of [5, 6]) {
      await $.turn.start({ turnId: `t${t}`, text: 'fix the build' })
      await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: `t${t}`, reason: 'answer' })
    }
    release()
    await w.clock.settle()

    expect(w.fetches).toHaveLength(1)
    expect(plugin(w).length).toBeLessThanOrEqual(1)
  })

  test('a manual or auto compaction starts the turn count again', async ($, on) => {
    const w = world(on, ON, pauseAt(0.9))

    await turns($, w.clock, 4)
    await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'fix the build', toolUses: [] }] })
    await turns($, w.clock, 4, 5)
    await $.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: 'fix the build', toolUses: [] }] })
    await turns($, w.clock, 4, 9)
    expect(w.fetches).toEqual([])

    await turns($, w.clock, 1, 13)
    expect(w.fetches).toHaveLength(1)
  })

  test('a fired pause resets the router: the next turn routes afresh', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router,compact' }, pauseAt(0.9))
    const routed = () => w.fetches.filter(f => 'model' in f.questions).length
    const stepped = async (n: number, from: number) => {
      for (let t = from; t < from + n; t++) {
        await $.turn.start({ turnId: `t${t}`, text: 'fix the build' })
        const stream = $.turn.step({ turnId: `t${t}`, index: 0, model: 'claude-opus-5', effort: 'high', messageCount: 1 })
        for await (const _ of stream);
        await stream.result
        await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: `t${t}`, reason: 'answer' })
        await w.clock.settle()
      }
    }

    await stepped(5, 1)
    expect(routed()).toBe(1)
    expect(plugin(w)).toHaveLength(1)

    await stepped(1, 6)
    expect(routed()).toBe(2)
  })
})
