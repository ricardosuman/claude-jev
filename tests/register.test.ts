import type { AgentOfferInput, HttpResponse, On, RenderInput, ToolDescribeInput, TurnStepInput } from 'claude-code'
import { describe, expect, mock, test, type Engine } from 'claude-code/testing'

import { LEDGER_KEY } from '../hooks/jev'

const PRESENTATION = { isFullscreen: false, columns: 80 }
const SUBTLE_THRESHOLD = 0.6

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

/**
 * A Jev body answering the router: `model` at `confidence`, the effort level
 * `effort` (0 low, 1 medium, 2 high) as the argmax of its probabilities at
 * `effortConfidence` (default `confidence`), and `risky` and `subtle` (default 0.1).
 */
function jevBody(
  model: string,
  confidence: number,
  effort = 0,
  { effortConfidence = confidence, risky = 0.1, subtle = 0.1 } = {},
): string {
  const probabilities = { '0': 0.1, '1': 0.1, '2': 0.1, [String(effort)]: 0.8 }

  return JSON.stringify({
    answers: {
      model: { type: 'choice', choice: model, confidence, probabilities: { [model]: confidence } },
      risky: { type: 'noul', noul: risky },
      subtle: { type: 'noul', noul: subtle },
      effort: {
        type: 'score',
        score: effort / 2,
        confidence: effortConfidence,
        legend: { '0': 'low', '1': 'medium', '2': 'high' },
        probabilities,
      },
    },
    usage: { input_tokens: 400, output_tokens: 70 },
  })
}

function findBody(confidence: readonly number[]): string {
  return JSON.stringify({
    answers: Object.fromEntries(confidence.map((n, i) => [`p${i}`, { type: 'noul', noul: n }])),
    usage: { input_tokens: 400, output_tokens: 70 },
  })
}

function toolDescribeBody(confidence: Record<string, number>): string {
  return JSON.stringify({
    answers: Object.fromEntries(Object.entries(confidence).map(([group, noul]) => [group, { type: 'noul', noul }])),
    usage: { input_tokens: 400, output_tokens: 70 },
  })
}

/**
 * The world beneath the router: env and key, a Jev answering `body` (or failing
 * when it is an Error), and a model that records what each step and spawn asked for.
 */
function world(
  on: On,
  env: Record<string, string>,
  first: string | Error,
  { throwUi = false, throwAgentRegister = false, hangFetch = false } = {},
) {
  let body = first
  const fetches: string[] = []
  const questions: Record<string, unknown>[] = []
  const states: unknown[] = []
  const steps: { model: string; effort?: TurnStepInput['effort'] }[] = []
  const spawns: (string | undefined)[] = []
  const agents: { name: string; description: string; prompt: string; model?: string }[] = []
  const clock = mock.clock(on)
  mock.store(on)
  mock.env(on, { TYPESAFE_API_KEY: 'k', ...env })
  on('http.fetch', async ($, e) => {
    fetches.push(e.url)
    const request = JSON.parse(String(e.init?.body)) as { questions: Record<string, unknown>; state: unknown }
    questions.push(request.questions)
    states.push(request.state)
    if (hangFetch) return { value: await new Promise<HttpResponse>(() => undefined) }
    if (body instanceof Error) throw body

    return { value: { status: 200, ok: true, headers: {}, text: body } satisfies HttpResponse }
  })
  on('turn.step', async function* ($, e) {
    steps.push(e.effort === undefined ? { model: e.model } : { model: e.model, effort: e.effort })

    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('agent.spawn', ($, e) => {
    spawns.push(e.model)

    return { model: e.model ?? e.parentModel }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('session.compact', ($, e) =>
    e.instructions === 'skip' ? { skip: 'off' } : { messages: [{ role: 'user', text: 'summary', toolUses: [] }] },
  )
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('agent.register', ($, e) => {
    if (throwAgentRegister) throw new Error('agent register failed')
    agents.push(e)

    return { value: { agent: `jev:${e.name}` } }
  })
  const logs: string[] = []
  on('ui.log', ($, e) => {
    if (throwUi) throw new Error('ui log failed')
    logs.push(e.text)

    return { value: undefined }
  })
  const statuses: (string | undefined)[] = []
  on('ui.status', ($, e) => {
    if (throwUi) throw new Error('ui status failed')
    statuses.push(e.text)

    return { value: undefined }
  })
  on('tool.describe', ($, e) => ({ description: `next:${e.description}`, isDeferred: false }))

  return { clock, fetches, questions, states, steps, spawns, agents, logs, statuses, answer: (next: string) => void (body = next) }
}

/**
 * Runs one main-loop turn of `steps` model requests on `model` at `effort`.
 */
async function turnOf(
  $: Engine,
  turnId: string,
  text: string,
  steps = 1,
  model = 'claude-opus-5',
  effort: TurnStepInput['effort'] | null = 'high',
) {
  await $.turn.start({ turnId, text })
  for (let index = 0; index < steps; index++) await stepOf($, { turnId, index, model, effort: effort ?? undefined })
}

const sessionStartOf = ($: Engine) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })

const laneOfferOf = (agent = 'jev:lane'): AgentOfferInput => ({
  agent,
  description: 'lane',
  source: 'plugin',
  provider: { plugin: 'jev', tier: 'user' },
})

/**
 * Runs one model request: main's on opus at high unless `step` says otherwise
 * (`effort: undefined`: a model without effort).
 */
async function stepOf($: Engine, step: Partial<TurnStepInput> & Pick<TurnStepInput, 'turnId' | 'index'>) {
  const input: TurnStepInput = { model: 'claude-opus-5', effort: 'high', messageCount: 1, ...step }
  if (input.effort === undefined) delete input.effort
  const stream = $.turn.step(input)
  for await (const _ of stream);
  await stream.result
}

/**
 * jevBody with its parsed answers changed by `change`, or its text by a function of it.
 */
function malformedBody(change: (answers: Record<string, Record<string, unknown>>) => void): string {
  const body = JSON.parse(jevBody('haiku', 0.9, 0))
  change(body.answers)

  return JSON.stringify(body)
}

const COMPOSER = { origin: { kind: 'composer' as const }, presentation: PRESENTATION }

const ledgerOf = async ($: Engine) => {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const { text } = await $.command.run({ command: 'jev', args: 'json', ...COMPOSER })

  return JSON.parse(text ?? '') as Record<string, unknown>[]
}

const spawnOf = ($: Engine, spawn: { model?: string; fork?: boolean; parentModel?: string; subagentType?: string }) =>
  $.agent.spawn({
    prompt: 'find where the config is read',
    description: 'find config',
    subagentType: 'general-purpose',
    parentModel: 'claude-opus-5',
    fork: false,
    ...spawn,
  } as Parameters<Engine['agent']['spawn']>[0])

const toolDescribeOf = ($: Engine, tool: string, providerPlugin = 'engine'): Promise<{ description: string; isDeferred?: boolean }> =>
  $.tool.describe({
    tool,
    description: `${tool} description`,
    provider: { plugin: providerPlugin, tier: providerPlugin === 'engine' ? 'core' : 'user' },
  } satisfies ToolDescribeInput)

describe('register', () => {
  test('/jev text prints the summary of a seeded ledger', async ($, on) => {
    mock.clock(on)
    mock.store(on, {
      [LEDGER_KEY]: [
        { at: 1, purpose: 'p', keys: ['a'], ok: true, latencyMs: 300, usage: { input_tokens: 400, output_tokens: 70 } },
        { at: 2, purpose: 'p', keys: ['a'], ok: false, latencyMs: 1500 },
        { at: 3, purpose: 'p', keys: ['a'], ok: true, latencyMs: 500, usage: { input_tokens: 100, output_tokens: 30 } },
        { at: 4, contextTokens: 5000, contextPercent: 3, costUsd: 0.12 },
        { at: 5, contextTokens: 9000, contextPercent: 5, costUsd: 0.25 },
      ],
    })
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', ($, e) => ({ value: { command: e.name } }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const { text } = await $.command.run({
      command: 'jev',
      args: 'text',
      origin: { kind: 'composer' },
      presentation: PRESENTATION,
    })

    expect(text).toBe(
      [
        'Jev calls: 3 (2 ok, 1 failed)',
        'p50 latency: 500 ms',
        'Jev tokens: 500 in / 100 out',
        'Session cost: $0.2500',
        'Context: 5%',
        'Router: -',
        'Offload: 0 results, 0 chars saved, 0 fallbacks',
        'Compact: 0/0 pauses fired',
      ].join('\n'),
    )
  })

  test('session.measure appends a cost row', async ($, on) => {
    const clock = mock.clock(on, { now: 7 })
    mock.store(on)
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', ($, e) => ({ value: { command: e.name } }))
    on('session.measure', ($, e) => ({ changed: e.changed }))

    await $.session.measure({
      context: { tokens: 1200, window: 200000, percent: 1 },
      rateLimits: [],
      cost: { usd: 0.031 },
      changed: ['context', 'cost'],
    })
    await clock.settle()
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const { text } = await $.command.run({
      command: 'jev',
      args: 'text',
      origin: { kind: 'composer' },
      presentation: PRESENTATION,
    })

    expect(text).toContain('Session cost: $0.0310')
    expect(text).toContain('Context: 1%')
  })

  test('router off: steps untouched, Jev never asked', async ($, on) => {
    const w = world(on, {}, jevBody('haiku', 0.95))

    await turnOf($, 't1', 'what is 2+2?', 2)

    expect(w.steps).toEqual([
      { model: 'claude-opus-5', effort: 'high' },
      { model: 'claude-opus-5', effort: 'high' },
    ])
    expect(w.fetches).toEqual([])
  })

  test('find off leaves jev-find unregistered', async ($, on) => {
    const w = world(on, {}, findBody([]))

    await sessionStartOf($)

    const result = await $.tool.call({ tool: 'mcp__jev__jev-find', paths: 'a.ts' })

    expect(result).toMatchObject({ deny: 'jev-find is disabled' })
    expect(w.fetches).toEqual([])
  })

  test('find on returns confident path indices and records the suggestion', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'find' }, findBody([0.8, 0.2, 0.6, 0.1, 0.59, 0.91, 0.4, 0.3, 0.7, 0.05]))
    const paths = ['src/router.ts', 'src/pane.ts', 'hooks/jev.ts', 'README.md', 'types/claude-code.d.ts', 'tests/register.test.ts', 'src/other.ts', 'bench/run.ts', 'hooks/offload.ts', 'package.json']

    await sessionStartOf($)
    await $.turn.start({ turnId: 't1', text: 'Find the router registration and its ledger tests.' })

    const result = await $.tool.call({ tool: 'mcp__jev__jev-find', paths: paths.join(',') })
    const output = JSON.parse(String(result.result)) as Record<string, unknown>

    expect(Object.keys(output).sort()).toEqual(['indices', 'proposal', 'reason'])
    expect(output).toEqual({
      indices: [0, 2, 5, 8],
      reason: 'likely relevant paths found',
      proposal: 'Suggested paths: src/router.ts, hooks/jev.ts, tests/register.test.ts, hooks/offload.ts',
    })
    expect(w.fetches).toHaveLength(1)
    expect(Object.keys(w.questions[0] ?? {})).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'])
    expect(w.questions[0]!.p0).toMatchObject({ type: 'noul', instructions: expect.stringContaining('Which of these paths are relevant to this task?') })

    await w.clock.settle()
    const row = (await ledgerOf($)).find(entry => entry.purpose === 'find.result')
    expect(row).toMatchObject({
      purpose: 'find.result',
      paths,
      confidence: [0.8, 0.2, 0.6, 0.1, 0.59, 0.91, 0.4, 0.3, 0.7, 0.05],
      indices: [0, 2, 5, 8],
      skip_count: 6,
    })
  })

  test('find fails open for empty paths and a failed Jev call', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'find' }, new Error('offline'))

    await sessionStartOf($)
    await $.turn.start({ turnId: 't1', text: 'Find the relevant files.' })

    const empty = await $.tool.call({ tool: 'mcp__jev__jev-find', paths: '  ,\n ' })
    expect(JSON.parse(String(empty.result))).toEqual({
      indices: [],
      reason: 'unavailable',
      proposal: 'No suggestion available.',
    })
    expect(w.fetches).toEqual([])

    const failed = await $.tool.call({ tool: 'mcp__jev__jev-find', paths: 'a.ts\nb.ts' })
    expect(JSON.parse(String(failed.result))).toEqual({
      indices: [],
      reason: 'unavailable',
      proposal: 'No suggestion available.',
    })
    expect(w.fetches).toHaveLength(1)
    await w.clock.settle()
    expect((await ledgerOf($)).filter(entry => entry.purpose === 'find.result')).toMatchObject([
      { paths: [], confidence: [], indices: [], skip_count: 0 },
      { paths: ['a.ts', 'b.ts'], confidence: [], indices: [], skip_count: 2 },
    ])
  })

  test('find fails open when Jev times out', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'find' }, findBody([]), { hangFetch: true })

    await sessionStartOf($)
    await $.turn.start({ turnId: 't1', text: 'Find the relevant files.' })
    const pending = $.tool.call({ tool: 'mcp__jev__jev-find', paths: 'a.ts,b.ts' })

    await w.clock.settle()
    await w.clock.advance(1500)
    const result = await pending

    expect(JSON.parse(String(result.result))).toMatchObject({ indices: [], reason: 'unavailable' })
    expect(w.fetches).toHaveLength(1)
    await w.clock.settle()
    expect((await ledgerOf($)).filter(entry => entry.purpose === 'find.result')).toMatchObject([
      { paths: ['a.ts', 'b.ts'], confidence: [], indices: [], skip_count: 2 },
    ])
  })

  test('tool-describe off passes the describe result through unchanged and never asks Jev', async ($, on) => {
    const w = world(on, {}, toolDescribeBody({ web: 0.1 }))

    await sessionStartOf($)
    await $.turn.start({ turnId: 't1', text: 'Use the web documentation.' })

    expect(await toolDescribeOf($, 'WebFetch')).toEqual({ description: 'next:WebFetch description', isDeferred: false })
    expect(w.fetches).toEqual([])
  })

  test('tool-describe records what it would defer and defers nothing: shadow-only, and does not cache the answer', async ($, on) => {
    on('tool.list', () => ({
      value: [
        { name: 'WebFetch', description: 'fetch', mcp: false },
        { name: 'mcp__github__search', description: 'search', mcp: true },
      ],
    }))
    const w = world(on, { JEV_COMPONENTS: 'tool-describe' }, toolDescribeBody({ web: 0.4, 'mcp:github': 0.8 }))

    await sessionStartOf($)
    await $.turn.start({ turnId: 't1', text: 'Use the web documentation.' })

    // 0.4 is under the 0.6 threshold, so this is the group it would have hidden;
    // the description still goes through untouched.
    const web = (await toolDescribeOf($, 'WebFetch')) as Record<string, unknown>
    expect(web).toEqual({ description: 'next:WebFetch description', isDeferred: false })
    expect(Object.keys(w.questions[0] ?? {}).sort()).toEqual(['mcp:github', 'web'])
    expect(w.states[0]).toEqual({ task: 'Use the web documentation.', tool: 'WebFetch' })

    expect(await toolDescribeOf($, 'mcp__github__search', 'mcp:github')).toEqual({
      description: 'next:mcp__github__search description',
      isDeferred: false,
    })
    expect(w.fetches).toHaveLength(2)

    await w.clock.settle()
    const rows = (await ledgerOf($)).filter(entry => 'group' in entry)
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: 'tool.describe', group: 'web', confidence: 0.4, deferred: true, shadow: true }),
        expect.objectContaining({ purpose: 'tool.describe', group: 'mcp:github', confidence: 0.8, deferred: false, shadow: true }),
      ]),
    )
  })

  test('tool-describe fails open on a Jev timeout', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'tool-describe' }, toolDescribeBody({ web: 0.1 }), { hangFetch: true })

    await sessionStartOf($)
    await $.turn.start({ turnId: 't1', text: 'Use the web documentation.' })
    const pending = toolDescribeOf($, 'WebFetch')

    await w.clock.settle()
    await w.clock.advance(1500)

    expect(await pending).toEqual({ description: 'next:WebFetch description', isDeferred: false })
    expect(w.fetches).toHaveLength(1)
  })

  test('the default model allowlist sends all three model criteria', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9))

    await turnOf($, 't1', 'what is 2+2?')

    expect(Object.keys((w.questions[0]!.model as { criteria: Record<string, string> }).criteria)).toEqual([
      'haiku',
      'sonnet',
      'opus',
    ])
  })

  test('JEV_MODELS removes sonnet from the question and is recorded in the ledger', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router', JEV_MODELS: 'haiku,opus' }, jevBody('haiku', 0.9))

    await turnOf($, 't1', 'what is 2+2?')
    await w.clock.settle()

    const criteria = (w.questions[0]!.model as { criteria: Record<string, string> }).criteria
    expect(Object.keys(criteria)).toEqual(['haiku', 'opus'])
    expect(criteria).not.toHaveProperty('sonnet')
    expect(criteria.opus).toContain('Everything beyond direct lookups')
    expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision')).toMatchObject([{ models: ['haiku', 'opus'] }])
  })

  test('JEV_MODELS accepts mixed-case names', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router', JEV_MODELS: ' HaIkU, OpUs ' }, jevBody('haiku', 0.9))

    await turnOf($, 't1', 'what is 2+2?')

    expect(Object.keys((w.questions[0]!.model as { criteria: Record<string, string> }).criteria)).toEqual(['haiku', 'opus'])
  })

  test('an unknown model name is dropped from the allowlist', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router', JEV_MODELS: 'haiku,unknown,opus' }, jevBody('haiku', 0.9))

    await turnOf($, 't1', 'what is 2+2?')
    await w.clock.settle()

    expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision')).toMatchObject([{ models: ['haiku', 'opus'] }])
  })

  test('an answer naming a model outside JEV_MODELS is malformed', async ($, on) => {
    const w = world(
      on,
      { JEV_COMPONENTS: 'router', JEV_MODELS: 'haiku,opus' },
      malformedBody(a => void (a.model!.choice = 'sonnet')),
    )

    await turnOf($, 't1', 'what is 2+2?')
    await w.clock.settle()

    expect(w.steps).toEqual([{ model: 'claude-opus-5', effort: 'high' }])
    expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision')).toMatchObject([
      { models: ['haiku', 'opus'], applied: false, reason: 'malformed' },
    ])
  })

  for (const value of ['', 'not-a-model,still-not-a-model']) {
    test(`JEV_MODELS=${JSON.stringify(value)} falls back to all model criteria`, async ($, on) => {
      const w = world(on, { JEV_COMPONENTS: 'router', JEV_MODELS: value }, jevBody('haiku', 0.9))

      await turnOf($, 't1', 'what is 2+2?')

      expect(Object.keys((w.questions[0]!.model as { criteria: Record<string, string> }).criteria)).toEqual([
        'haiku',
        'sonnet',
        'opus',
      ])
    })
  }

  test('a confident haiku/low holds for the later steps and turns', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))

    await turnOf($, 't1', 'what is 2+2?', 2)
    await turnOf($, 't2', 'and 3+3?')

    expect(w.steps).toEqual([
      { model: 'claude-haiku-4-5-20251001', effort: 'low' },
      { model: 'claude-haiku-4-5-20251001', effort: 'low' },
      { model: 'claude-haiku-4-5-20251001', effort: 'low' },
    ])
    expect(w.fetches).toHaveLength(1)
  })

  test('a model without effort gets none', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))

    await turnOf($, 't1', 'what is 2+2?', 1, 'claude-opus-5', null)

    expect(w.steps).toEqual([{ model: 'claude-haiku-4-5-20251001' }])
  })

  test('low confidence leaves the steps untouched and is held', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.5, 0))

    await turnOf($, 't1', 'what is 2+2?')
    await turnOf($, 't2', 'and 3+3?')

    expect(w.steps).toEqual([
      { model: 'claude-opus-5', effort: 'high' },
      { model: 'claude-opus-5', effort: 'high' },
    ])
    expect(w.fetches).toHaveLength(1)
  })

  test('a failed Jev call leaves the step untouched and is held until a compaction', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, new Error('offline'))

    await turnOf($, 't1', 'what is 2+2?', 2)
    await turnOf($, 't2', 'and 3+3?')
    expect(w.fetches).toHaveLength(1)

    await $.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: 'what is 2+2?', toolUses: [] }] })
    await turnOf($, 't3', 'and 4+4?')

    expect(w.steps.every(s => s.model === 'claude-opus-5' && s.effort === 'high')).toBe(true)
    expect(w.fetches).toHaveLength(2)
  })

  test('never routes above the session model, effort still lowers', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('opus', 0.9, 1))

    await turnOf($, 't1', 'refactor the auth layer', 1, 'claude-sonnet-5')

    expect(w.steps).toEqual([{ model: 'claude-sonnet-5', effort: 'medium' }])
  })

  test('a model of unknown tier is never routed', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))

    await turnOf($, 't1', 'what is 2+2?', 1, 'some-other-model')

    expect(w.steps).toEqual([{ model: 'some-other-model', effort: 'high' }])
  })

  test('after a /model switch the held decision stands down', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))

    await turnOf($, 't1', 'what is 2+2?')
    await turnOf($, 't2', 'and 3+3?', 1, 'claude-sonnet-5')

    expect(w.steps).toEqual([
      { model: 'claude-haiku-4-5-20251001', effort: 'low' },
      { model: 'claude-sonnet-5', effort: 'high' },
    ])
  })

  test('a manual model override is recorded once, reported, and reset by a cold point', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.81, 0))

    await turnOf($, 't1', 'what is 2+2?', 1, 'claude-sonnet-5')
    await turnOf($, 't2', 'and 3+3?', 3, 'claude-opus-5')
    await w.clock.settle()

    const afterOverride = (await ledgerOf($)).filter(row => row.purpose === 'route.decision' && row.scope === 'session')
    expect(afterOverride).toHaveLength(2)
    expect(afterOverride.filter(row => row.supersededBy !== undefined)).toHaveLength(1)
    expect(afterOverride.at(-1)).toMatchObject({
      chosen: 'haiku/low',
      confidence: 0.81,
      applied: true,
      supersededBy: 'opus',
    })
    expect(w.steps).toEqual([
      { model: 'claude-haiku-4-5-20251001', effort: 'low' },
      { model: 'claude-opus-5', effort: 'high' },
      { model: 'claude-opus-5', effort: 'high' },
      { model: 'claude-opus-5', effort: 'high' },
    ])
    expect(w.logs).toEqual(['jev: session → haiku/low (0.81)', 'jev: session decision dropped, /model opus'])
    expect(w.statuses).toEqual(['jev: haiku/low · 0 agents', 'jev: opus (manual) · 0 agents'])

    const overriddenPane = JSON.stringify(await $.ui.render(JEV_PANE))
    expect(overriddenPane).toContain('Session: haiku/low · 0.81 · superseded by /model opus')
    expect(overriddenPane).not.toContain('Session: haiku/low · 0.81 · applied')

    w.answer(jevBody('sonnet', 0.9, 1))
    await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'and 3+3?', toolUses: [] }] })
    await turnOf($, 't3', 'and 4+4?', 1, 'claude-opus-5')
    await w.clock.settle()

    const freshPane = JSON.stringify(await $.ui.render(JEV_PANE))
    expect(freshPane).toContain('Session: sonnet/medium · 0.90 · applied')
    expect(w.statuses).toEqual([
      'jev: haiku/low · 0 agents',
      'jev: opus (manual) · 0 agents',
      'jev: sonnet/medium · 0 agents',
    ])
  })

  test('a compaction and a session end (/clear, resume) each reset the decision', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))

    await turnOf($, 't1', 'what is 2+2?')
    await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'what is 2+2?', toolUses: [] }] })
    await turnOf($, 't2', 'and 3+3?')
    await turnOf($, 't3', 'and 4+4?')
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
    await turnOf($, 't4', 'and 5+5?')

    expect(w.fetches).toHaveLength(3)
  })

  // a cancelled /resume fires no session.end, so it is covered by there being none
  test('a precompute, a skipped compaction and a subagent compaction keep the decision', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))
    const messages = [{ role: 'user' as const, text: 'what is 2+2?', toolUses: [] }]

    await turnOf($, 't1', 'what is 2+2?')
    await $.session.compact({ trigger: 'precompute', messages })
    await $.session.compact({ trigger: 'manual', messages, instructions: 'skip' })
    await $.session.compact({ trigger: 'auto', agentId: 'a1', messages })
    await turnOf($, 't2', 'and 3+3?')

    expect(w.fetches).toHaveLength(1)
    expect(w.steps.at(-1)).toEqual({ model: 'claude-haiku-4-5-20251001', effort: 'low' })
  })

  test('a compaction mid-turn: the next step decides afresh, the step after keeps it', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))

    await turnOf($, 't1', 'fix the flaky test', 2)
    w.answer(jevBody('sonnet', 0.9, 1))
    await $.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: 'fix the flaky test', toolUses: [] }] })
    await stepOf($, { turnId: 't1', index: 2 })
    await stepOf($, { turnId: 't1', index: 3 })

    expect(w.steps).toEqual([
      { model: 'claude-haiku-4-5-20251001', effort: 'low' },
      { model: 'claude-haiku-4-5-20251001', effort: 'low' },
      { model: 'claude-sonnet-5', effort: 'medium' },
      { model: 'claude-sonnet-5', effort: 'medium' },
    ])
    expect(w.fetches).toHaveLength(2)
  })

  test('effort never rises: a step at low stays low when Jev says high', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 2))

    await turnOf($, 't1', 'what is 2+2?', 1, 'claude-opus-5', 'low')

    expect(w.steps).toEqual([{ model: 'claude-haiku-4-5-20251001', effort: 'low' }])
  })

  test("a subagent's step passes through and leaves the session decision held", async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))

    await turnOf($, 't1', 'what is 2+2?')
    await stepOf($, { turnId: 'sub', index: 0, agentId: 'a1' })
    await turnOf($, 't2', 'and 3+3?')

    expect(w.steps).toEqual([
      { model: 'claude-haiku-4-5-20251001', effort: 'low' },
      { model: 'claude-opus-5', effort: 'high' },
      { model: 'claude-haiku-4-5-20251001', effort: 'low' },
    ])
    expect(w.fetches).toHaveLength(1)
  })

  for (const [name, body] of [
    ['null answers', JSON.stringify({ answers: null })],
    ['a string confidence', malformedBody(a => void (a.model!.confidence = '0.9'))],
    ['a missing confidence', malformedBody(a => void delete a.model!.confidence)],
    ['a non-finite confidence', jevBody('haiku', 0.9, 0).replace('"confidence":0.9', '"confidence":1e999')],
    ['null probabilities', malformedBody(a => void (a.effort!.probabilities = null))],
    ['empty probabilities', malformedBody(a => void (a.effort!.probabilities = {}))],
    ['a probability key past the levels', malformedBody(a => void (a.effort!.probabilities = { '7': 1 }))],
    ['a null choice', malformedBody(a => void (a.model!.choice = null))],
    ['a choice outside the set', malformedBody(a => void (a.model!.choice = 'typo-haiku'))],
    ['a wrong type', malformedBody(a => void (a.effort!.type = 'choice'))],
  ] as const) {
    test(`a malformed answer (${name}) passes the step through, held until a compaction`, async ($, on) => {
      const w = world(on, { JEV_COMPONENTS: 'router' }, body)

      await turnOf($, 't1', 'what is 2+2?')
      await turnOf($, 't2', 'and 3+3?')
      expect(w.fetches).toHaveLength(1)

      await $.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: 'what is 2+2?', toolUses: [] }] })
      await turnOf($, 't3', 'and 4+4?')
      await w.clock.settle()

      expect(w.steps).toEqual([
        { model: 'claude-opus-5', effort: 'high' },
        { model: 'claude-opus-5', effort: 'high' },
        { model: 'claude-opus-5', effort: 'high' },
      ])
      expect(w.fetches).toHaveLength(2)
      if (name !== 'null answers') {
        expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision')).toMatchObject([
          { applied: false, reason: 'malformed' },
          { applied: false, reason: 'malformed' },
        ])
      }
    })
  }

  for (const [confidence, model] of [
    [0.7, 'claude-haiku-4-5-20251001'],
    [0.6999, 'claude-opus-5'],
  ] as const) {
    test(`confidence ${confidence} against minConfidence 0.7 routes to ${model}`, async ($, on) => {
      const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', confidence, 2))

      await turnOf($, 't1', 'what is 2+2?')

      expect(w.steps).toEqual([{ model, effort: 'high' }])
    })
  }

  test('agent.spawn: forks and explicit models untouched, inherited routed below the parent', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9))

    await spawnOf($, { fork: true })
    await spawnOf($, { model: 'opus' })
    await spawnOf($, {})

    expect(w.spawns).toEqual([undefined, 'opus', 'claude-haiku-4-5-20251001'])
    expect(w.fetches).toHaveLength(1)
  })

  test('agent.spawn respects the model allowlist', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router', JEV_MODELS: 'haiku' }, jevBody('sonnet', 0.9))

    await spawnOf($, {})

    expect(w.spawns).toEqual([undefined])
    expect(Object.keys((w.questions[0]!.model as { criteria: Record<string, string> }).criteria)).toEqual(['haiku'])
  })

  test('agent.spawn never routes above the parent model', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('opus', 0.9))

    await spawnOf($, { parentModel: 'claude-sonnet-5' })

    expect(w.spawns).toEqual([undefined])
  })

  test('agent.spawn gets the resolved haiku id below a sonnet parent, never the alias', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9))

    await spawnOf($, { parentModel: 'claude-sonnet-5' })

    expect(w.spawns).toEqual(['claude-haiku-4-5-20251001'])
  })

  test('agent.spawn leaves a type with its own model (Explore) untouched', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('sonnet', 0.9))

    await spawnOf($, { subagentType: 'Explore' })
    await spawnOf($, {})

    expect(w.spawns).toEqual([undefined, 'claude-sonnet-5'])
    expect(w.fetches).toHaveLength(1)
  })

  test('agent.spawn passes through a choice outside the set', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, malformedBody(a => void (a.model!.choice = 'typo-haiku')))

    await spawnOf($, {})

    expect(w.spawns).toEqual([undefined])
  })

  test('lanes off: no lane registration or nudge, and routing is unchanged', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))

    await sessionStartOf($)
    await turnOf($, 't1', 'what is 2+2?')

    expect(w.agents).toEqual([])
    expect(w.steps).toEqual([{ model: 'claude-haiku-4-5-20251001', effort: 'low' }])
    expect(w.fetches).toHaveLength(1)
  })

  test('lanes on: a held session registers lane and offers its delegation nudge', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router,lanes' }, jevBody('haiku', 0.9, 0, { subtle: 0.61 }))

    await sessionStartOf($)
    await turnOf($, 't1', 'make the cache update safe')

    expect(w.steps).toEqual([{ model: 'claude-opus-5', effort: 'high' }])
    expect(w.agents).toHaveLength(1)
    expect(w.agents[0]).toMatchObject({ name: 'lane' })
    expect(w.agents[0]!.description).toContain('search many files')
    expect(w.agents[0]!.description).toContain('bounded change')
    expect(w.agents[0]!.description).toContain('verification')
    expect(w.agents[0]!.description).toContain('not use for a one-line edit')
    expect(w.agents[0]!.prompt).toContain('Report conclusions compactly')
    expect(w.agents[0]!.prompt).toContain('Do not paste whole files')
    expect(w.agents[0]).not.toHaveProperty('model')
    expect(await $.agent.offer(laneOfferOf())).toEqual({ isOffered: true })
  })

  test('an effort-only route keeps the lane offered on the current model', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router,lanes' }, jevBody('haiku', 0.5, 0, { effortConfidence: 0.9 }))

    await sessionStartOf($)
    await turnOf($, 't1', 'what is 2+2?')

    expect(w.steps).toEqual([{ model: 'claude-opus-5', effort: 'low' }])
    expect(await $.agent.offer(laneOfferOf())).toEqual({ isOffered: true })
  })

  test('lanes on after a downgrade registers no visible nudge', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router,lanes' }, jevBody('haiku', 0.9, 0))

    await sessionStartOf($)
    await turnOf($, 't1', 'what is 2+2?')

    expect(w.steps).toEqual([{ model: 'claude-haiku-4-5-20251001', effort: 'low' }])
    expect(w.agents).toHaveLength(1)
    expect(await $.agent.offer(laneOfferOf())).toEqual({ isOffered: false })
  })

  test('a downgrade suppresses the lane nudge for the rest of the session', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router,lanes' }, jevBody('haiku', 0.9, 0))

    await sessionStartOf($)
    await turnOf($, 't1', 'what is 2+2?')
    w.answer(jevBody('opus', 0.9, 0, { subtle: 0.9 }))
    await $.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: 'what is 2+2?', toolUses: [] }] })
    await turnOf($, 't2', 'make the cache update safe')

    expect(await $.agent.offer(laneOfferOf())).toEqual({ isOffered: false })
  })

  test('lane spawns reuse agent routing and receive a full model id', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router,lanes' }, jevBody('opus', 0.9, 0, { subtle: 0.9 }))

    await sessionStartOf($)
    await turnOf($, 't1', 'make the cache update safe')
    w.answer(jevBody('haiku', 0.9))
    await spawnOf($, { subagentType: 'jev:lane', parentModel: 'claude-sonnet-5' })
    await w.clock.settle()

    expect(w.spawns).toEqual(['claude-haiku-4-5-20251001'])
    expect(w.fetches).toHaveLength(2)
    expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision' && row.scope === 'agent')).toMatchObject([
      { scope: 'agent', subagentType: 'jev:lane', chosen: 'haiku', applied: true, appliedModel: 'haiku' },
    ])
    expect(w.logs).toContain('jev: jev:lane → haiku (0.90)')
  })

  test('a lane spawn never routes above its parent', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router,lanes' }, jevBody('opus', 0.9, 0, { subtle: 0.9 }))

    await sessionStartOf($)
    await turnOf($, 't1', 'make the cache update safe')
    w.answer(jevBody('opus', 0.9))
    await spawnOf($, { subagentType: 'jev:lane', parentModel: 'claude-sonnet-5' })
    await w.clock.settle()

    expect(w.spawns).toEqual([undefined])
    expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision' && row.scope === 'agent')).toMatchObject([
      { scope: 'agent', subagentType: 'jev:lane', applied: false, reason: 'not below the parent model' },
    ])
  })

  for (const [veto, answer] of [
    ['risky', { risky: 0.9 }],
    ['subtle', { subtle: 0.9 }],
  ] as const) {
    test(`a lane spawn is held by the ${veto} veto`, async ($, on) => {
      const w = world(on, { JEV_COMPONENTS: 'router,lanes' }, jevBody('haiku', 0.9, 0, answer))

      await sessionStartOf($)
      await turnOf($, 't1', 'do the sensitive work')
      await spawnOf($, { subagentType: 'jev:lane' })
      await w.clock.settle()

      expect(w.spawns).toEqual([undefined])
      expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision' && row.scope === 'agent')).toMatchObject([
        { scope: 'agent', subagentType: 'jev:lane', applied: false, reason: veto },
      ])
    })
  }

  test('a failed lane registration leaves the held session working', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router,lanes' }, jevBody('haiku', 0.9, 0, { subtle: 0.9 }), {
      throwAgentRegister: true,
    })

    await sessionStartOf($)
    await turnOf($, 't1', 'make the cache update safe')

    expect(w.steps).toEqual([{ model: 'claude-opus-5', effort: 'high' }])
    expect(w.agents).toEqual([])
    expect(await $.agent.offer(laneOfferOf())).toEqual({ isOffered: false })
  })

  test('/jev json prints the ledger; /jev text shows the decision', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))

    await turnOf($, 't1', 'what is 2+2?')
    await w.clock.settle()
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const json = await $.command.run({ command: 'jev', args: 'json', origin: { kind: 'composer' }, presentation: PRESENTATION })
    const summary = await $.command.run({ command: 'jev', args: 'text', origin: { kind: 'composer' }, presentation: PRESENTATION })

    expect(JSON.parse(json.text ?? '')).toMatchObject([
      { purpose: 'route.session', keys: ['model', 'effort', 'risky', 'subtle'], ok: true },
      { purpose: 'route.decision', scope: 'session', chosen: 'haiku/low', confidence: 0.9, subtle: 0.1, applied: true },
    ])
    expect(summary.text).toContain('Router: haiku/low (confidence 0.90, applied)')
  })

  test('a session and subagent decision each emit one transcript line', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))

    await turnOf($, 't1', 'what is 2+2?')
    await spawnOf($, {})

    expect(w.logs).toEqual([
      'jev: session → haiku/low (0.90)',
      'jev: general-purpose → haiku (0.90)',
    ])
    expect(w.statuses).toEqual(['jev: haiku/low · 0 agents', 'jev: haiku/low · 1 agent'])
  })

  test('a held decision emits one line with its reason', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0, { subtle: 0.61 }))

    await turnOf($, 't1', 'make the cache update safe')

    expect(w.logs).toEqual(['jev: session held on opus (subtle 0.61)'])
  })

  test('a router pass-through emits no transcript line', async ($, on) => {
    const w = world(on, {}, jevBody('haiku', 0.9))

    await turnOf($, 't1', 'what is 2+2?')

    expect(w.logs).toEqual([])
  })

  test('a throwing UI call does not break routing', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0), { throwUi: true })

    await turnOf($, 't1', 'what is 2+2?')

    expect(w.steps).toEqual([{ model: 'claude-haiku-4-5-20251001', effort: 'low' }])
  })

  test('/jev opens and toggles the pane; json stays raw and the pane redraws from the ledger', async ($, on) => {
    const clock = mock.clock(on, { now: 7 })
    const ledger = [
      {
        at: 1,
        purpose: 'route.decision' as const,
        scope: 'session' as const,
        chosen: 'sonnet/low',
        confidence: 0.96,
        models: ['haiku', 'sonnet', 'opus'],
        applied: true,
        appliedModel: 'sonnet',
      },
      {
        at: 2,
        purpose: 'route.decision' as const,
        scope: 'agent' as const,
        subagentType: 'general-purpose',
        chosen: 'haiku',
        confidence: 1,
        models: ['haiku', 'sonnet', 'opus'],
        applied: true,
        appliedModel: 'haiku',
      },
      {
        at: 3,
        purpose: 'route.decision' as const,
        scope: 'agent' as const,
        subagentType: 'lane',
        chosen: 'sonnet',
        confidence: 0.91,
        models: ['haiku', 'sonnet', 'opus'],
        applied: false,
        heldModel: 'opus',
        reason: 'subtle',
        subtle: 0.9,
      },
      {
        at: 4,
        purpose: 'offload.result' as const,
        tool: 'Bash',
        charsIn: 10000,
        charsOut: 4000,
        chunks: 5,
        kept: 2,
        fallback: false,
      },
      { at: 5, purpose: 'route.session', keys: ['model'], ok: true, latencyMs: 300, usage: { input_tokens: 10, output_tokens: 2 } },
      { at: 6, purpose: 'route.agent', keys: ['model'], ok: false, latencyMs: 500 },
      { at: 7, contextTokens: 9000, contextPercent: 42, costUsd: 0.1234 },
    ]
    mock.store(on, { [LEDGER_KEY]: ledger })
    const opened: string[] = []
    const closed: string[] = []
    const invalidated: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', ($, e) => ({ value: { command: e.name } }))
    on('session.measure', ($, e) => ({ changed: e.changed }))
    on('ui.open', ($, e) => {
      opened.push(e.id)

      return { value: undefined }
    })
    on('ui.close', ($, e) => {
      closed.push(e.id)

      return { value: undefined }
    })
    on('ui.invalidate', ($, e) => {
      invalidated.push(e.event)

      return { value: undefined }
    })

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.command.run({ command: 'jev', args: '', origin: { kind: 'composer' }, presentation: PRESENTATION })
    expect(opened).toEqual(['jev'])

    const json = await $.command.run({ command: 'jev', args: 'json', origin: { kind: 'composer' }, presentation: PRESENTATION })
    expect(JSON.parse(json.text ?? '')).toEqual(ledger)

    const drawn = JSON.stringify(await $.ui.render(JEV_PANE))
    expect(drawn).toContain('Session: sonnet/low')
    expect(drawn).toContain('lane → sonnet')
    expect(drawn).toContain('general-purpose → haiku')
    expect(drawn).toContain('Offload: 1 trimmed · 10000 in → 4000 out')
    expect(drawn).toContain('Jev: 2 calls · 1 ok/1 failed · p50 300 ms')
    expect(drawn).toContain('Cost: $0.1234 · Context: 42%')

    await $.session.measure({
      context: { tokens: 10000, window: 200000, percent: 50 },
      rateLimits: [],
      cost: { usd: 0.2 },
      changed: ['context', 'cost'],
    })
    await clock.settle()
    expect(invalidated).toContain('ui.render')

    await $.command.run({ command: 'jev', args: '', origin: { kind: 'composer' }, presentation: PRESENTATION })
    expect(closed).toEqual(['jev'])
  })

  // ponytail: the kit loads the mod with plugin.json's defaults (router "off") and
  // an inline plugin can't import register, so only the env side is testable here
  test('JEV_COMPONENTS without router keeps the router off', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'other' }, jevBody('haiku', 0.9, 0))

    await turnOf($, 't1', 'what is 2+2?')

    expect(w.steps).toEqual([{ model: 'claude-opus-5', effort: 'high' }])
    expect(w.fetches).toEqual([])
  })
  for (const [risky, model] of [
    [0.71, 'claude-opus-5'],
    [0.7, 'claude-haiku-4-5-20251001'],
  ] as const) {
    test(`risky ${risky}: the session ${risky > 0.7 ? 'is held as is' : 'is routed'}`, async ($, on) => {
      const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0, { risky }))

      await turnOf($, 't1', 'drop the users table in production')
      await w.clock.settle()

      expect(w.steps).toEqual([{ model, effort: risky > 0.7 ? 'high' : 'low' }])
      expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision')).toMatchObject([
        risky > 0.7 ? { applied: false, reason: 'risky', risky } : { applied: true, risky },
      ])
      expect(w.statuses).toEqual([risky > 0.7 ? 'jev: hold (risky) · 0 agents' : 'jev: haiku/low · 0 agents'])
    })
  }

  test('a risky spawn keeps its inherited model', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0, { risky: 0.9 }))

    await spawnOf($, {})

    expect(w.spawns).toEqual([undefined])
    expect(w.fetches).toHaveLength(1)
  })

  for (const [subtle, model] of [
    [SUBTLE_THRESHOLD + 0.01, 'claude-opus-5'],
    [SUBTLE_THRESHOLD, 'claude-haiku-4-5-20251001'],
  ] as const) {
    test(`subtle ${subtle}: the session ${subtle > SUBTLE_THRESHOLD ? 'is held with reason subtle' : 'is routed at the threshold'}`, async ($, on) => {
      const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0, { subtle }))

      await turnOf($, 't1', 'make the cache update safe')
      await w.clock.settle()

      expect(w.steps).toEqual([{ model, effort: subtle > SUBTLE_THRESHOLD ? 'high' : 'low' }])
      const row = (await ledgerOf($)).find(entry => entry.purpose === 'route.decision')
      expect(row).toMatchObject({ subtle, applied: subtle === SUBTLE_THRESHOLD })
      if (subtle > SUBTLE_THRESHOLD) expect(row).toMatchObject({ reason: 'subtle' })
      expect(w.statuses).toEqual([subtle > SUBTLE_THRESHOLD ? 'jev: hold (subtle) · 0 agents' : 'jev: haiku/low · 0 agents'])
    })
  }

  test('a subtle spawn keeps its inherited model', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0, { subtle: 0.9 }))

    await spawnOf($, {})
    await w.clock.settle()

    expect(w.spawns).toEqual([undefined])
    expect(w.fetches).toHaveLength(1)
    expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision')).toMatchObject([
      { scope: 'agent', subtle: 0.9, applied: false, reason: 'subtle' },
    ])
  })

  test('risky and subtle together hold once', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0, { risky: 0.9, subtle: 0.9 }))

    await turnOf($, 't1', 'make the cache update safe')
    await w.clock.settle()

    expect(w.steps).toEqual([{ model: 'claude-opus-5', effort: 'high' }])
    expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision')).toEqual([
      expect.objectContaining({ applied: false, reason: 'risky', risky: 0.9, subtle: 0.9 }),
    ])
    expect(w.statuses).toEqual(['jev: hold (risky) · 0 agents'])
  })

  for (const [name, change] of [
    ['a missing risky', (a: Record<string, Record<string, unknown>>) => void delete a.risky],
    ['a risky past 1', (a: Record<string, Record<string, unknown>>) => void (a.risky!.noul = 1.5)],
    ['a missing subtle', (a: Record<string, Record<string, unknown>>) => void delete a.subtle],
    ['a subtle past 1', (a: Record<string, Record<string, unknown>>) => void (a.subtle!.noul = 1.5)],
  ] as const) {
    test(`${name} is a malformed answer, for the session and a spawn`, async ($, on) => {
      const w = world(on, { JEV_COMPONENTS: 'router' }, malformedBody(change))

      await turnOf($, 't1', 'what is 2+2?')
      await spawnOf($, {})
      await w.clock.settle()

      expect(w.steps).toEqual([{ model: 'claude-opus-5', effort: 'high' }])
      expect(w.spawns).toEqual([undefined])
      expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision')).toMatchObject([
        { reason: 'malformed' },
        { reason: 'malformed' },
      ])
    })
  }

  test('a confident model with an unconfident effort lowers only the model', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0, { effortConfidence: 0.5 }))

    await turnOf($, 't1', 'what is 2+2?', 2)
    await w.clock.settle()

    expect(w.steps).toEqual([
      { model: 'claude-haiku-4-5-20251001', effort: 'high' },
      { model: 'claude-haiku-4-5-20251001', effort: 'high' },
    ])
    expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision')).toEqual([
      expect.objectContaining({ confidence: 0.9, effortConfidence: 0.5, applied: true, appliedModel: 'haiku' }),
    ])
    expect((await ledgerOf($)).at(-1)).not.toHaveProperty('appliedEffort')
    expect(w.statuses).toEqual(['jev: haiku/- · 0 agents'])
  })

  test('a confident effort with an unconfident model lowers only the effort', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.5, 0, { effortConfidence: 0.9 }))

    await turnOf($, 't1', 'what is 2+2?')
    await w.clock.settle()

    expect(w.steps).toEqual([{ model: 'claude-opus-5', effort: 'low' }])
    expect((await ledgerOf($)).filter(row => row.purpose === 'route.decision')).toEqual([
      expect.objectContaining({ confidence: 0.5, effortConfidence: 0.9, applied: true, appliedEffort: 'low' }),
    ])
    expect(w.statuses).toEqual(['jev: -/low · 0 agents'])
  })

  test('the status line is drawn only when the held decision changes', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0))
    const messages = [{ role: 'user' as const, text: 'what is 2+2?', toolUses: [] }]

    await turnOf($, 't1', 'what is 2+2?', 3)
    await turnOf($, 't2', 'and 3+3?', 2)
    await $.session.compact({ trigger: 'auto', messages })
    await turnOf($, 't3', 'and 4+4?')
    w.answer(jevBody('haiku', 0.9, 0, { risky: 0.95 }))
    await $.session.compact({ trigger: 'auto', messages })
    await turnOf($, 't4', 'now drop the prod table')

    expect(w.fetches).toHaveLength(3)
    expect(w.statuses).toEqual(['jev: haiku/low · 0 agents', 'jev: hold (risky) · 0 agents'])
  })
})
