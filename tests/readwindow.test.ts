import type { HttpResponse, On } from 'claude-code'
import { describe, expect, mock, test, type Engine } from 'claude-code/testing'

const PRESENTATION = { isFullscreen: false, columns: 80 }
const GOAL = 'where is the window target defined'
const NEEDLE = 'THE_ANSWER_IS_WINDOW_TARGET unique line for scoring'
const SECRET_PATH = '/Users/secret/project/register.ts'
const SMALL = Array.from({ length: 40 }, (_, i) => `small ${i}`).join('\n')
const LARGE = Array.from({ length: 500 }, (_, i) =>
  i === 250 ? NEEDLE : `export const line${i} = ${i} // padding padding padding padding padding`,
).join('\n')
const BOUNDARY = Array.from({ length: 450 }, () => 'x').join('\n')

function world(
  on: On,
  env: Record<string, string>,
  noul: ((instructions: string) => unknown) | Error,
  files: Record<string, string>,
  { hangFetch = false } = {},
) {
  const fetches: { questions: Record<string, { instructions: string }>; state: unknown }[] = []
  const forwarded: Record<string, unknown>[] = []
  const clock = mock.clock(on)
  mock.store(on)
  mock.env(on, { TYPESAFE_API_KEY: 'k', ...env })
  on('http.fetch', async ($, e) => {
    const body = JSON.parse(String(e.init?.body)) as (typeof fetches)[number]
    fetches.push(body)
    if (hangFetch) return { value: await new Promise<HttpResponse>(() => undefined) }
    if (noul instanceof Error) throw noul
    const answers = Object.fromEntries(
      Object.entries(body.questions).map(([key, q]) => [key, { type: 'noul', noul: noul(q.instructions) }]),
    )

    return {
      value: {
        status: 200,
        ok: true,
        headers: {},
        text: JSON.stringify({ answers, usage: { input_tokens: 400, output_tokens: 70 } }),
      } satisfies HttpResponse,
    }
  })
  on('fs.stat', ($, e) =>
    e.path in files
      ? { value: { kind: 'file' as const, size: files[e.path]!.length, mtimeMs: 0, isLink: false } }
      : { deny: 'ENOENT' },
  )
  on('fs.read', ($, e) => (e.path in files ? { value: files[e.path]! } : { deny: 'ENOENT' }))
  on('tool.call', ($, e) => {
    const input = e as { tool: string; file_path?: string }
    forwarded.push({ ...input })
    const text = typeof input.file_path === 'string' ? (files[input.file_path] ?? '') : ''

    return {
      ref: 1,
      result: { type: 'text', file: { filePath: input.file_path, content: text, numLines: 1, startLine: 1, totalLines: 1 } },
    } as never
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))

  return { clock, fetches, forwarded }
}

const ledgerOf = async ($: Engine) => {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const { text } = await $.command.run({ command: 'jev', args: 'json', origin: { kind: 'composer' }, presentation: PRESENTATION })

  return JSON.parse(text ?? '') as Record<string, unknown>[]
}

const windowRowsOf = (ledger: Record<string, unknown>[]) => ledger.filter(row => row.purpose === 'read.window')

const needleScore = (instructions: string) => (instructions.includes(NEEDLE) ? 0.9 : 0.1)

describe('readwindow', () => {
  test('a file under 400 lines is passed through untouched and writes no row', async ($, on) => {
    const w = world(on, {}, needleScore, { [SECRET_PATH]: SMALL })

    await $.turn.start({ turnId: 't1', text: GOAL })
    const result = await $.tool.call({ tool: 'Read', file_path: SECRET_PATH })
    await w.clock.settle()

    expect(result.ref).toBe(1)
    expect(w.forwarded).toEqual([expect.objectContaining({ tool: 'Read', file_path: SECRET_PATH })])
    expect(w.forwarded[0]).not.toHaveProperty('offset')
    expect(w.forwarded[0]).not.toHaveProperty('limit')
    expect(w.fetches).toEqual([])
    expect(windowRowsOf(await ledgerOf($))).toEqual([])
  })

  test('a large file with a Jev window still delivers the original Read', async ($, on) => {
    const w = world(on, {}, needleScore, { [SECRET_PATH]: LARGE })

    await $.turn.start({ turnId: 't1', text: GOAL })
    const result = await $.tool.call({ tool: 'Read', file_path: SECRET_PATH })
    await w.clock.settle()

    expect(result.ref).toBe(1)
    expect(w.forwarded).toEqual([expect.objectContaining({ tool: 'Read', file_path: SECRET_PATH })])
    expect(w.forwarded[0]).not.toHaveProperty('offset')
    expect(w.forwarded[0]).not.toHaveProperty('limit')
    expect(w.fetches).toHaveLength(1)

    const row = windowRowsOf(await ledgerOf($)).at(-1)
    expect(row).toMatchObject({
      purpose: 'read.window',
      file: 'register.ts',
      fileLines: 500,
      shadow: true,
    })
    expect(row!.windowStart).toBeGreaterThan(0)
    expect(row!.windowEnd).toBeGreaterThan(row!.windowStart as number)
    expect(row!.targetLine).toBeGreaterThan(0)
    expect(251).toBeGreaterThanOrEqual(row!.windowStart as number)
    expect(251).toBeLessThanOrEqual(row!.windowEnd as number)
    expect((row!.windowEnd as number) - (row!.windowStart as number) + 1).toBe(Math.floor(500 * 0.2))
  })

  test('a Jev timeout records a zero window and does not stall the Read', async ($, on) => {
    const w = world(on, {}, needleScore, { [SECRET_PATH]: LARGE }, { hangFetch: true })

    await $.turn.start({ turnId: 't1', text: GOAL })
    const pending = $.tool.call({ tool: 'Read', file_path: SECRET_PATH })
    await w.clock.settle()
    await w.clock.advance(1500)
    const result = await pending
    await w.clock.settle()

    expect(result.ref).toBe(1)
    expect(w.forwarded).toEqual([expect.objectContaining({ tool: 'Read', file_path: SECRET_PATH })])
    expect(windowRowsOf(await ledgerOf($)).at(-1)).toMatchObject({
      purpose: 'read.window',
      file: 'register.ts',
      fileLines: 500,
      windowStart: 0,
      windowEnd: 0,
      shadow: true,
      jev: { attempted: true, apiOk: false, failure: 'timeout-or-failure' },
    })
  })

  test('no middle chunks records the failure and still delivers the original Read', async ($, on) => {
    const w = world(on, {}, needleScore, { [SECRET_PATH]: BOUNDARY })

    await $.turn.start({ turnId: 't1', text: GOAL })
    const result = await $.tool.call({ tool: 'Read', file_path: SECRET_PATH })
    await w.clock.settle()

    expect(result.ref).toBe(1)
    expect(w.forwarded).toEqual([expect.objectContaining({ tool: 'Read', file_path: SECRET_PATH })])
    expect(w.fetches).toEqual([])
    expect(windowRowsOf(await ledgerOf($)).at(-1)).toMatchObject({
      purpose: 'read.window',
      file: 'register.ts',
      fileLines: 450,
      windowStart: 0,
      windowEnd: 0,
      shadow: true,
      jev: { attempted: false, failure: 'no-middle-chunks' },
    })
  })

  test('JEV_COMPONENTS=read-window cannot turn shadow off', async ($, on) => {
    const w = world(on, { JEV_COMPONENTS: 'read-window' }, needleScore, { [SECRET_PATH]: LARGE })

    await $.turn.start({ turnId: 't1', text: GOAL })
    const result = await $.tool.call({ tool: 'Read', file_path: SECRET_PATH })
    await w.clock.settle()

    expect(result.ref).toBe(1)
    expect(w.forwarded[0]).not.toHaveProperty('offset')
    expect(windowRowsOf(await ledgerOf($)).at(-1)).toMatchObject({ shadow: true, file: 'register.ts' })
  })

  test('the ledger stores a file name, never a path, and never the prompt', async ($, on) => {
    const w = world(on, {}, needleScore, { [SECRET_PATH]: LARGE })

    await $.turn.start({ turnId: 't1', text: GOAL })
    await $.tool.call({ tool: 'Read', file_path: SECRET_PATH })
    await w.clock.settle()

    const ledger = await ledgerOf($)
    const dumped = JSON.stringify(ledger)
    const row = windowRowsOf(ledger).at(-1)
    expect(row).toMatchObject({ file: 'register.ts', shadow: true })
    expect(row!.file).toBe('register.ts')
    expect(dumped).not.toContain('/Users/secret')
    expect(dumped).not.toContain(SECRET_PATH)
    expect(dumped).not.toContain(GOAL)
  })
})
