import type { AgentOfferInput, HttpResponse, On, RenderInput, TurnStepInput } from 'claude-code'
import { describe, expect, mock, test, type Engine } from 'claude-code/testing'

import { LEDGER_KEY, type LedgerRow } from '../hooks/jev'
import { paneTextOf } from '../hooks/pane'

const PRESENTATION = { isFullscreen: false, columns: 80 }
const JEV_PANE: RenderInput<'Pane'> = {
  component: 'Pane',
  surface: 'terminal',
  requestId: 'jev',
  viewport: { columns: 160, rows: 40 },
  props: {
    title: 'Jev',
    isFocused: false,
    bodyColumns: 44,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
}

function routeBody(
  model: string,
  confidence: number,
  effort = 0,
  { risky = 0.1, subtle = 0.1 } = {},
): string {
  return JSON.stringify({
    answers: {
      model: { type: 'choice', choice: model, confidence, probabilities: { [model]: confidence } },
      risky: { type: 'noul', noul: risky },
      subtle: { type: 'noul', noul: subtle },
      effort: {
        type: 'score',
        score: effort / 2,
        confidence,
        legend: { '0': 'low', '1': 'medium', '2': 'high' },
        probabilities: { '0': effort === 0 ? 0.8 : 0.1, '1': effort === 1 ? 0.8 : 0.1, '2': effort === 2 ? 0.8 : 0.1 },
      },
    },
  })
}

function routeWorld(on: On, env: Record<string, string>, body: string, held?: Promise<void>) {
  const fetches: string[] = []
  const questions: Record<string, unknown>[] = []
  const steps: { model: string; effort?: TurnStepInput['effort'] }[] = []
  const spawns: (string | undefined)[] = []
  const agents: unknown[] = []
  const logs: string[] = []
  const statuses: string[] = []
  const compactions: unknown[] = []
  const clock = mock.clock(on)
  mock.store(on)
  mock.env(on, { TYPESAFE_API_KEY: 'k', ...env })
  on('http.fetch', async ($, e) => {
    fetches.push(e.url)
    const request = JSON.parse(String(e.init?.body)) as { questions: Record<string, unknown> }
    questions.push(request.questions)
    await held

    const text = Object.hasOwn(request.questions, 'pause') ? JSON.stringify({ answers: { pause: { type: 'noul', noul: 0.96 } } }) : body

    return { value: { status: 200, ok: true, headers: {}, text } satisfies HttpResponse }
  })
  on('turn.step', async function* ($, e) {
    steps.push(e.effort === undefined ? { model: e.model } : { model: e.model, effort: e.effort })

    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('agent.spawn', ($, e) => {
    spawns.push(e.model)

    return { model: e.model ?? e.parentModel }
  })
  on('agent.register', ($, e) => {
    agents.push(e)

    return { value: { agent: `jev:${e.name}` } }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.usage', () => ({ value: { context: { tokens: 140000, window: 200000, percent: 70 }, rateLimits: [] } }))
  on('session.compact', ($, e) => {
    compactions.push(e)

    return { messages: e.messages ?? [{ role: 'user', text: 'summary', toolUses: [] }] }
  })
  on('ui.log', ($, e) => {
    logs.push(e.text)

    return { value: undefined }
  })
  on('ui.status', ($, e) => {
    statuses.push(e.text ?? '')

    return { value: undefined }
  })

  return { clock, fetches, questions, steps, spawns, agents, logs, statuses, compactions }
}

async function stepOf($: Engine, step: Partial<TurnStepInput> & Pick<TurnStepInput, 'turnId' | 'index'>) {
  const input: TurnStepInput = { model: 'claude-opus-5', effort: 'high', messageCount: 1, ...step }
  const stream = $.turn.step(input)
  for await (const _ of stream);
  await stream.result
}

async function ledgerOf($: Engine) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const { text } = await $.command.run({ command: 'jev', args: 'json', origin: { kind: 'composer' }, presentation: PRESENTATION })

  return JSON.parse(text ?? '') as Record<string, unknown>[]
}

const sessionStartOf = ($: Engine) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
const laneOfferOf = (agent = 'jev:lane'): AgentOfferInput => ({
  agent,
  description: 'lane',
  source: 'plugin',
  provider: { plugin: 'jev', tier: 'user' },
})

const LOG = Array.from({ length: 400 }, (_, i) => (i === 200 ? 'FATAL db: connection pool exhausted' : `INFO ${String(i).padStart(4, '0')} request served ok`)).join('\n')

function offloadWorld(on: On) {
  const fetches: { questions: Record<string, unknown>; state: unknown }[] = []
  const writes: { path: string; text: string }[] = []
  const clock = mock.clock(on)
  mock.store(on)
  mock.env(on, { TYPESAFE_API_KEY: 'k', JEV_COMPONENTS: 'offload,shadow' })
  on('http.fetch', ($, e) => {
    const request = JSON.parse(String(e.init?.body)) as (typeof fetches)[number]
    fetches.push(request)
    const answers = Object.fromEntries(
      Object.entries(request.questions).map(([key, question]) => [key, { type: 'noul', noul: String((question as { instructions: string }).instructions).includes('FATAL') ? 0.9 : 0.1 }]),
    )

    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ answers }) } satisfies HttpResponse }
  })
  on('fs.write', ($, e) => {
    writes.push({ path: e.path, text: e.text })

    return { value: undefined }
  })
  on('session.root', () => ({ value: '/work' }))
  on('tool.call', ($, e) => ({ ref: 1, result: { stdout: LOG, stderr: '', interrupted: false }, text: 'core text' }) as never)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))

  return { clock, fetches, writes }
}

describe('shadow', () => {
  test('router shadow asks Jev without changing the held steps, records a proposal, and renders it as one', async ($, on) => {
    let release!: () => void
    const held = new Promise<void>(resolve => (release = resolve))
    const w = routeWorld(on, { JEV_COMPONENTS: 'router,shadow' }, routeBody('sonnet', 0.96), held)

    await $.turn.start({ turnId: 't1', text: 'explain the cache behavior' })
    await stepOf($, { turnId: 't1', index: 0 })
    expect(w.steps).toEqual([{ model: 'claude-opus-5', effort: 'high' }])

    release()
    await w.clock.settle()
    await stepOf($, { turnId: 't1', index: 1 })

    expect(w.steps).toEqual([
      { model: 'claude-opus-5', effort: 'high' },
      { model: 'claude-opus-5', effort: 'high' },
    ])
    expect(w.fetches).toHaveLength(1)
    const rows = await ledgerOf($)
    expect(rows).toMatchObject([
      { purpose: 'route.session', shadow: true, ok: true },
      {
        purpose: 'route.decision',
        shadow: true,
        chosen: 'sonnet/low',
        confidence: 0.96,
        applied: false,
        wouldApply: true,
        appliedModel: 'sonnet',
        appliedEffort: 'low',
        runningModel: 'opus',
      },
    ])
    expect(w.logs).toEqual(['jev (shadow): would route session sonnet/low (0.96) — running opus'])

    const pane = JSON.stringify(await $.ui.render(JEV_PANE))
    expect(pane).toContain('Session: would route sonnet/low')
    expect(pane).toContain('Shadow: 1 downgrades · 0 holds · 0 chars would be saved')
  })

  test('router shadow leaves an inherited spawn unchanged and records its proposal', async ($, on) => {
    const w = routeWorld(on, { JEV_COMPONENTS: 'router,shadow' }, routeBody('haiku', 0.96))

    const result = await $.agent.spawn({
      prompt: 'find the config reader',
      description: 'find config',
      subagentType: 'general-purpose',
      parentModel: 'claude-opus-5',
      fork: false,
    } as Parameters<Engine['agent']['spawn']>[0])
    await w.clock.settle()

    expect(result).toMatchObject({ model: 'claude-opus-5' })
    expect(w.spawns).toEqual([undefined])
    expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision')).toMatchObject([
      {
        scope: 'agent',
        shadow: true,
        chosen: 'haiku',
        applied: false,
        wouldApply: true,
        runningModel: 'opus',
      },
    ])
  })

  test('shadow lanes register nothing, offer nothing, and record one would-offer row on a held route', async ($, on) => {
    const w = routeWorld(on, { JEV_COMPONENTS: 'router,lanes,shadow' }, routeBody('haiku', 0.96, 0, { subtle: 0.9 }))

    await sessionStartOf($)
    await $.turn.start({ turnId: 't1', text: 'make the cache update safe' })
    await stepOf($, { turnId: 't1', index: 0 })
    await w.clock.settle()

    expect(w.agents).toEqual([])
    expect(await $.agent.offer(laneOfferOf())).toEqual({ isOffered: false })
    expect((await ledgerOf($)).filter(row => row.purpose === 'lane.offer')).toEqual([
      { purpose: 'lane.offer', shadow: true, offered: true, heldModel: 'opus', at: expect.any(Number) },
    ])
  })

  test('offload shadow analyzes the result but returns it byte-for-byte and does not write files', async ($, on) => {
    const w = offloadWorld(on)

    await $.turn.start({ turnId: 't1', text: 'what is the fatal error?' })
    const result = await $.tool.call({ tool: 'Bash', command: 'cat app.log' })

    expect(result).toEqual({ ref: 1, result: { stdout: LOG, stderr: '', interrupted: false }, text: 'core text' })
    expect(w.writes).toEqual([])
    await w.clock.settle()
    const rows = await ledgerOf($)
    const offload = rows.find(row => row.purpose === 'offload.result')!
    expect(offload).toMatchObject({ purpose: 'offload.result', shadow: true, charsIn: LOG.length, charsSaved: expect.any(Number) })
    expect(offload.charsSaved).toBe((offload.charsIn as number) - (offload.charsOut as number))
    expect((rows.find(row => row.purpose === 'offload') as Record<string, unknown>).shadow).toBe(true)
    expect(paneTextOf(rows as unknown as LedgerRow[])).toContain(`${offload.charsSaved} chars would be saved`)
  })

  test('shadow compact records a would-fire pause without compacting', async ($, on) => {
    const w = routeWorld(on, { JEV_COMPONENTS: 'compact,shadow' }, routeBody('haiku', 0.96))

    for (let i = 0; i < 5; i++) {
      await $.turn.start({ turnId: `t${i}`, text: 'finish the build' })
      await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: `t${i}`, reason: 'answer' })
    }
    await w.clock.settle()

    expect(w.compactions).toEqual([])
    expect((await ledgerOf($)).filter(row => row.purpose === 'compact.pause')).toMatchObject([
      { shadow: true, fired: false, wouldFire: true, p: 0.96 },
    ])
  })

  test('shadow off keeps the live router behavior', async ($, on) => {
    const w = routeWorld(on, { JEV_COMPONENTS: 'router' }, routeBody('haiku', 0.96))

    await $.turn.start({ turnId: 't1', text: 'what is 2+2?' })
    await stepOf($, { turnId: 't1', index: 0 })

    expect(w.steps).toEqual([{ model: 'claude-haiku-4-5-20251001', effort: 'low' }])
    expect((await ledgerOf($)).some(row => row.shadow === true)).toBe(false)
  })
})
