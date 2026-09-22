import type { HttpResponse, On, TurnStepInput } from 'claude-code'
import { describe, expect, mock, test, type Engine } from 'claude-code/testing'

import type { DecisionRow, OffloadRow } from '../hooks/jev'
import {
  appendUsage,
  gainsSummary,
  gainsText,
  ROTATE_BYTES,
  usageLineOf,
  usagePath,
  type UsageHost,
  type UsageLine,
} from '../hooks/usage'

const PRESENTATION = { isFullscreen: false, columns: 80 }
const AT = Date.parse('2026-09-21T12:00:00.000Z')
const HOME = '/Users/me'
const USAGE = usagePath(HOME)
const PROMPT = 'what is the fatal error in app.log and also DELETE FROM users?'

function memoryHost(
  {
    files = {},
    sessionId = 'sess-1',
    failWrite = false,
    statSize = {} as Record<string, number>,
  }: {
    files?: Record<string, string>
    sessionId?: string | null
    failWrite?: boolean
    statSize?: Record<string, number>
  } = {},
): UsageHost & { files: Record<string, string> } {
  const host: UsageHost & { files: Record<string, string> } = {
    files,
    home: async () => HOME,
    sessionId: async () => {
      if (sessionId === null) throw new Error('no session')

      return sessionId
    },
    read: async path => {
      if (!(path in files)) throw new Error('ENOENT')

      return files[path]!
    },
    write: async (path, text) => {
      if (failWrite) throw new Error('EACCES')
      files[path] = text
    },
    stat: async path => {
      if (!(path in files)) throw new Error('ENOENT')

      return { size: statSize[path] ?? files[path]!.length }
    },
    list: async path => {
      const prefix = path.endsWith('/') ? path : `${path}/`

      return Object.keys(files)
        .filter(p => p.startsWith(prefix))
        .map(p => ({ name: p.slice(prefix.length).split('/')[0]! }))
    },
    exists: async path => path in files,
  }

  return host
}

const decision = (over: Partial<DecisionRow> = {}): DecisionRow => ({
  at: AT,
  purpose: 'route.decision',
  scope: 'session',
  chosen: 'haiku/low',
  confidence: 0.9,
  models: ['haiku', 'sonnet', 'opus'],
  applied: true,
  appliedModel: 'haiku',
  appliedEffort: 'low',
  fromModel: 'opus',
  ...over,
})

const offload = (over: Partial<OffloadRow> = {}): OffloadRow => ({
  at: AT,
  purpose: 'offload.result',
  tool: 'Bash',
  charsIn: 12000,
  charsOut: 4000,
  chunks: 5,
  kept: 2,
  fallback: false,
  ...over,
})

async function flushed(host: UsageHost) {
  for (let i = 0; i < 20; i++) await Promise.resolve()
  await gainsSummary(host)
}

function jevBody(model: string, confidence: number, effort = 0, { subtle = 0.1 } = {}): string {
  const probabilities = { '0': 0.1, '1': 0.1, '2': 0.1, [String(effort)]: 0.8 }

  return JSON.stringify({
    answers: {
      model: { type: 'choice', choice: model, confidence, probabilities: { [model]: confidence } },
      risky: { type: 'noul', noul: 0.1 },
      subtle: { type: 'noul', noul: subtle },
      effort: {
        type: 'score',
        score: effort / 2,
        confidence,
        legend: { '0': 'low', '1': 'medium', '2': 'high' },
        probabilities,
      },
    },
    usage: { input_tokens: 400, output_tokens: 70 },
  })
}

function pluginWorld(on: On, env: Record<string, string>, body: string | Error, { failWrite = false } = {}) {
  const files: Record<string, string> = {}
  const steps: { model: string; effort?: TurnStepInput['effort'] }[] = []
  const clock = mock.clock(on, { now: AT })
  mock.store(on)
  mock.env(on, { TYPESAFE_API_KEY: 'k', HOME, ...env })
  on('http.fetch', ($, e) => {
    if (body instanceof Error) throw body
    const request = JSON.parse(String(e.init?.body)) as { questions: Record<string, { instructions: string }> }
    if (Object.values(request.questions).some(q => q.instructions.includes('excerpt'))) {
      const answers = Object.fromEntries(
        Object.entries(request.questions).map(([key, q]) => [
          key,
          { type: 'noul', noul: q.instructions.includes('FATAL') ? 0.9 : 0.1 },
        ]),
      )

      return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ answers }) } satisfies HttpResponse }
    }

    return { value: { status: 200, ok: true, headers: {}, text: body } satisfies HttpResponse }
  })
  on('turn.step', async function* ($, e) {
    steps.push(e.effort === undefined ? { model: e.model } : { model: e.model, effort: e.effort })

    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.root', () => ({ value: '/work' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.compact', ($, e) =>
    e.instructions === 'skip' ? { skip: 'off' } : { messages: [{ role: 'user', text: 'summary', toolUses: [] }] },
  )
  on('ui.log', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('fs.write', ($, e) => {
    if (failWrite) return { deny: 'EACCES' }
    files[e.path] = e.text

    return { value: undefined }
  })
  on('fs.read', ($, e) => (e.path in files ? { value: files[e.path]! } : { deny: 'ENOENT' }))
  on('fs.stat', ($, e) =>
    e.path in files
      ? { value: { kind: 'file' as const, size: files[e.path]!.length, mtimeMs: 0, isLink: false } }
      : { deny: 'ENOENT' },
  )
  on('fs.list', ($, e) => {
    const prefix = `${e.path}/`
    const names = [...new Set(Object.keys(files).filter(p => p.startsWith(prefix)).map(p => p.slice(prefix.length).split('/')[0]!))]

    return { value: names.map(name => ({ name, kind: 'file' as const, size: files[`${prefix}${name}`]?.length ?? 0, isLink: false })) }
  })
  on('fs.exists', ($, e) => ({ value: e.path in files }))
  on('tool.call', () => ({ ref: 1, result: { stdout: `${'x'.repeat(9000)}\nFATAL boom`, stderr: '', interrupted: false }, text: 'core' }) as never)

  return { clock, files, steps }
}

async function turnOf($: Engine, text = PROMPT) {
  await $.turn.start({ turnId: 't1', text })
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5', effort: 'high', messageCount: 1 })
  for await (const _ of stream);
  await stream.result
}

const usageLinesOf = (files: Record<string, string>): UsageLine[] =>
  (files[USAGE] ?? '')
    .split('\n')
    .filter(line => line !== '')
    .map(line => JSON.parse(line) as UsageLine)

describe('usage line shape', () => {
  test('a routing decision is one line with ts, component, session, from/to and priceRatio', () => {
    const line = usageLineOf(decision(), 'sess-1')!

    expect(line).toMatchObject({
      ts: '2026-09-21T12:00:00.000Z',
      component: 'router',
      sessionId: 'sess-1',
      purpose: 'route.decision',
      chosen: 'haiku/low',
      fromModel: 'opus',
      applied: true,
      gain: { priceRatio: 1 / 5 },
    })
    expect(line).not.toHaveProperty('gain.tokensSaved')
    expect(JSON.stringify(line)).not.toContain('$')
  })

  test('a held decision is an activation and keeps its reason', () => {
    const line = usageLineOf(
      decision({ applied: false, appliedModel: undefined, appliedEffort: undefined, heldModel: 'opus', reason: 'subtle' }),
      'sess-1',
    )!

    expect(line).toMatchObject({
      component: 'router',
      applied: false,
      reason: 'subtle',
      heldModel: 'opus',
      gain: { priceRatio: 0.2 },
    })
  })

  test('an offload line has charsIn/charsOut and estimated tokensSaved', () => {
    const line = usageLineOf(offload(), 'sess-1')!

    expect(line).toMatchObject({
      component: 'offload',
      charsIn: 12000,
      charsOut: 4000,
      gain: { tokensSaved: 2000 },
    })
    expect(line).not.toHaveProperty('gain.priceRatio')
  })

  test('a Jev call row and a measure row are not activations', () => {
    expect(usageLineOf({ at: AT, purpose: 'route.session', keys: ['model'], ok: true, latencyMs: 10 })).toBeNull()
    expect(usageLineOf({ at: AT, contextPercent: 12, costUsd: 0.1 })).toBeNull()
  })

  test('a superseded re-record is not a second activation', () => {
    expect(usageLineOf(decision({ supersededBy: 'opus' }), 'sess-1')).toBeNull()
  })
})

describe('usage file', () => {
  test('append writes one json object per line and creates the path', async () => {
    const host = memoryHost()
    appendUsage(host, decision())
    await flushed(host)

    const raw = host.files[USAGE]!
    expect(raw.endsWith('\n')).toBe(true)
    expect(raw.trim().split('\n')).toHaveLength(1)
    expect(JSON.parse(raw)).toMatchObject({ component: 'router', sessionId: 'sess-1' })
  })

  test('a failing write does not throw', async () => {
    const host = memoryHost({ failWrite: true })

    appendUsage(host, decision())
    await flushed(host)
    expect(host.files[USAGE]).toBeUndefined()
  })

  test('rotation copies the current file and starts a new one', async () => {
    const host = memoryHost({
      files: { [USAGE]: '{"component":"router"}\n' },
      statSize: { [USAGE]: ROTATE_BYTES },
    })
    appendUsage(host, decision())
    await flushed(host)

    expect(host.files[`${HOME}/.claude/jev/usage-2026-09-21.jsonl`]).toBe('{"component":"router"}\n')
    expect(usageLinesOf(host.files)).toHaveLength(1)
    expect(usageLinesOf(host.files)[0]).toMatchObject({ component: 'router', chosen: 'haiku/low' })
  })
})

describe('/jev gains', () => {
  test('a seeded file prints the period, sessions, per-component totals and the honesty line', async () => {
    const lines: UsageLine[] = [
      usageLineOf(decision(), 's1')!,
      usageLineOf(
        decision({ at: AT + 1000, applied: false, appliedModel: undefined, heldModel: 'opus', reason: 'subtle', chosen: 'haiku/low' }),
        's1',
      )!,
      usageLineOf(decision({ at: AT + 2000, chosen: 'sonnet/medium', appliedModel: 'sonnet', fromModel: 'opus' }), 's2')!,
      usageLineOf(offload({ at: AT + 3000 }), 's2')!,
      {
        at: AT + 4000,
        ts: new Date(AT + 4000).toISOString(),
        component: 'compact',
        purpose: 'compact.pause',
        percent: 70,
        p: 0.9,
        fired: true,
      } as UsageLine,
    ]
    const text = gainsText(lines, ['usage-2026-09-01.jsonl'])

    expect(text).toContain('Jev usage 2026-09-21T12:00:00.000Z — 2026-09-21T12:00:04.000Z · 2 sessions')
    expect(text).toContain('router: 3 activations · 2 applied / 1 held')
    expect(text).toContain('chosen: haiku 2, sonnet 1')
    expect(text).toContain('offload: 1 activation')
    expect(text).toContain('8000 chars trimmed')
    expect(text).toContain('2000 estimated tokens saved')
    expect(text).toContain('compact: 1 activation · 1 applied / 0 held')
    expect(text).toContain('Older logs not included: usage-2026-09-01.jsonl')
    expect(text.endsWith('This summary cannot tell you whether the cheaper model took more turns.')).toBe(true)
    expect(text).not.toMatch(/\$\d/)
  })
})

describe('usage through the plugin', () => {
  test('a routing decision appends exactly one line with the right shape', async ($, on) => {
    const w = pluginWorld(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9))

    await turnOf($)
    await w.clock.settle()

    const lines = usageLinesOf(w.files)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      ts: '2026-09-21T12:00:00.000Z',
      component: 'router',
      sessionId: 'sess-1',
      purpose: 'route.decision',
      chosen: 'haiku/low',
      fromModel: 'opus',
      applied: true,
      gain: { priceRatio: 0.2 },
    })
    expect(JSON.stringify(lines[0])).not.toContain(PROMPT)
    expect(JSON.stringify(lines[0])).not.toContain('DELETE FROM')
  })

  test('a held decision appends one line with its reason', async ($, on) => {
    const w = pluginWorld(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9, 0, { subtle: 0.9 }))

    await turnOf($)
    await w.clock.settle()

    const lines = usageLinesOf(w.files)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      component: 'router',
      applied: false,
      reason: 'subtle',
      heldModel: 'opus',
    })
  })

  test('an offload appends one line with charsIn/charsOut and gain.tokensSaved', async ($, on) => {
    const w = pluginWorld(on, { JEV_COMPONENTS: 'offload' }, jevBody('haiku', 0.9))

    await $.turn.start({ turnId: 't1', text: PROMPT })
    await $.tool.call({ tool: 'Bash', command: 'cat app.log' })
    await w.clock.settle()

    const lines = usageLinesOf(w.files)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      component: 'offload',
      tool: 'Bash',
      fallback: expect.any(Boolean),
    })
    const offloadLine = lines[0] as OffloadRow & UsageLine
    expect(offloadLine.charsIn).toBeGreaterThan(offloadLine.charsOut)
    expect(offloadLine.gain?.tokensSaved).toBe(Math.round((offloadLine.charsIn - offloadLine.charsOut) / 4))
    expect(JSON.stringify(offloadLine)).not.toContain('FATAL boom')
    expect(JSON.stringify(offloadLine)).not.toContain(PROMPT)
  })

  test('a failing write does not break the turn', async ($, on) => {
    const w = pluginWorld(on, { JEV_COMPONENTS: 'router' }, jevBody('haiku', 0.9), { failWrite: true })

    await turnOf($)
    await w.clock.settle()

    expect(w.steps).toEqual([{ model: 'claude-haiku-4-5-20251001', effort: 'low' }])
    expect(w.files[USAGE]).toBeUndefined()
  })

  test('shadow rows carry shadow: true', async ($, on) => {
    const w = pluginWorld(on, { JEV_COMPONENTS: 'router,shadow' }, jevBody('haiku', 0.9))

    await turnOf($)
    await w.clock.settle()

    const lines = usageLinesOf(w.files)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ component: 'router', shadow: true, applied: false, wouldApply: true })
  })

  test('/jev gains on a seeded file prints the totals', async ($, on) => {
    const seeded = `${JSON.stringify(usageLineOf(decision(), 's1'))}\n${JSON.stringify(usageLineOf(offload(), 's1'))}\n`
    const w = pluginWorld(on, {}, jevBody('haiku', 0.9))
    w.files[USAGE] = seeded

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const { text } = await $.command.run({ command: 'jev', args: 'gains', origin: { kind: 'composer' }, presentation: PRESENTATION })

    expect(text).toContain('1 session')
    expect(text).toContain('router: 1 activation · 1 applied / 0 held')
    expect(text).toContain('offload:')
    expect(text).toContain('2000 estimated tokens saved')
    expect(text).toContain('This summary cannot tell you whether the cheaper model took more turns.')
  })
})

test('a find row keeps the count and never the path names', () => {
  const line = usageLineOf({
    at: Date.now(),
    purpose: 'find.result',
    paths: ['src/billing/customer-invoices.ts', 'src/acme/secret-feature.ts'],
    confidence: [0.9, 0.8],
    indices: [0, 1],
    skip_count: 0,
  } as never)

  expect(line).not.toBe(null)
  expect((line as { pathCount?: number }).pathCount).toBe(2)
  expect('paths' in (line as object)).toBe(false)
  expect(JSON.stringify(line).includes('acme')).toBe(false)
})
