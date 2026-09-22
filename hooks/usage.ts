import type { DecisionRow, LedgerRow, OffloadRow } from './jev'

/** $.fs.read/write reject over 4 MiB, so rotate under that; the ~5 MB figure is above the host cap. */
export const ROTATE_BYTES = 4 * 1024 * 1024 - 65536

const COMPONENTS = {
  'route.decision': 'router',
  'offload.result': 'offload',
  'compact.pause': 'compact',
  'lane.offer': 'lanes',
  'find.result': 'find',
  'tool.describe': 'tool-describe',
  'read.window': 'read-window',
} as const

type Component = (typeof COMPONENTS)[keyof typeof COMPONENTS]

const COMPONENT_ORDER: Component[] = ['router', 'offload', 'compact', 'lanes', 'find', 'tool-describe', 'read-window']

/** Opus $5/$25, Sonnet $2/$10, Haiku $1/$5 per MTok. Input and output ratios match. */
const PRICE_IN: Record<string, number> = { opus: 5, sonnet: 2, haiku: 1 }

export type UsageLine = LedgerRow & {
  ts: string
  component: Component
  sessionId?: string
  gain?: { tokensSaved?: number; priceRatio?: number }
  /** find.result's path count; the names themselves are never written */
  pathCount?: number
}

/**
 * File calls for the usage log. Built in register.ts so `$` stays in the hook
 * file; this module never touches `$`.
 */
export type UsageHost = {
  home: () => Promise<string | undefined>
  sessionId: () => Promise<string>
  read: (path: string) => Promise<string>
  write: (path: string, text: string) => Promise<void>
  stat: (path: string) => Promise<{ size: number }>
  list: (path: string) => Promise<readonly { name: string }[]>
  exists: (path: string) => Promise<boolean>
}

export function usageDir(home: string): string {
  return `${home}/.claude/jev`
}

export function usagePath(home: string): string {
  return `${usageDir(home)}/usage.jsonl`
}

let writing: Promise<void> = Promise.resolve()

/**
 * Appends one activation line; never throws, never awaited by the hook path.
 */
export function appendUsage(host: UsageHost, row: LedgerRow): void {
  writing = writing.then(() => appendNow(host, row)).catch(() => undefined)
}

/**
 * The current file's lines and any rotated sibling names. Waits for in-flight
 * appends so `/jev gains` sees the last activation.
 */
export async function readUsage(host: UsageHost): Promise<{ lines: UsageLine[]; rotated: string[] }> {
  await writing.catch(() => undefined)

  const home = await host.home().catch(() => undefined)
  if (!home) return { lines: [], rotated: [] }

  const path = usagePath(home)
  const text = await host.read(path).catch(() => '')
  const lines = parseLines(text)
  const rotated = await host
    .list(usageDir(home))
    .then(entries => entries.map(entry => entry.name).filter(name => /^usage-.+\.jsonl$/.test(name)))
    .catch(() => [])

  return { lines, rotated }
}

export async function gainsSummary(host: UsageHost): Promise<string> {
  const { lines, rotated } = await readUsage(host).catch(() => ({ lines: [] as UsageLine[], rotated: [] as string[] }))

  return gainsText(lines, rotated)
}

export function usageLineOf(row: LedgerRow, sessionId?: string): UsageLine | null {
  if (!('purpose' in row) || row.purpose === undefined) return null
  if ('supersededBy' in row && (row as DecisionRow).supersededBy !== undefined) return null

  const component = COMPONENTS[row.purpose as keyof typeof COMPONENTS]
  if (component === undefined) return null

  let ts: string
  try {
    ts = new Date(row.at).toISOString()
  } catch {
    return null
  }

  const gain = gainOf(row)
  // find.result carries real project paths; this file outlives the session, so
  // it keeps the count and drops the names.
  const { paths, ...rest } = row as LedgerRow & { paths?: string[] }
  const line: UsageLine = {
    ...rest,
    ...(paths ? { pathCount: paths.length } : {}),
    ts,
    component,
    ...(sessionId ? { sessionId } : {}),
    ...(gain ? { gain } : {}),
  }

  return line
}

export function gainsText(lines: readonly UsageLine[], rotated: readonly string[] = []): string {
  const out: string[] = []

  if (lines.length === 0) {
    out.push('No usage recorded yet.')
  } else {
    const times = lines.map(line => line.ts).sort()
    const sessions = new Set(lines.flatMap(line => (line.sessionId !== undefined ? [line.sessionId] : [])))
    const sessionText = sessions.size > 0 ? `${sessions.size} ${sessions.size === 1 ? 'session' : 'sessions'}` : 'sessions unknown'
    out.push(`Jev usage ${times[0]} — ${times.at(-1)} · ${sessionText}`)

    for (const component of COMPONENT_ORDER) {
      const rows = lines.filter(line => line.component === component)
      if (rows.length === 0) continue
      out.push(componentLine(component, rows))
      if (component === 'router') {
        const counts = chosenCounts(rows)
        if (counts.length > 0) out.push(`  chosen: ${counts.map(([name, n]) => `${name} ${n}`).join(', ')}`)
      }
    }
  }

  if (rotated.length > 0) out.push(`Older logs not included: ${rotated.join(', ')}`)
  out.push('This summary cannot tell you whether the cheaper model took more turns.')

  return out.join('\n')
}

async function appendNow(host: UsageHost, row: LedgerRow): Promise<void> {
  try {
    const home = await host.home()
    if (!home) return

    const sessionId = await host.sessionId().catch(() => undefined)
    const line = usageLineOf(row, sessionId)
    if (line === null) return

    const path = usagePath(home)
    const dir = usageDir(home)
    const chunk = `${JSON.stringify(line)}\n`
    const size = await host.stat(path).then(s => s.size, () => 0)
    let existing = ''

    if (size > 0 && size + chunk.length > ROTATE_BYTES) {
      const body = await host.read(path)
      const date = new Date(row.at).toISOString().slice(0, 10)
      let rotated = `${dir}/usage-${date}.jsonl`
      if (await host.exists(rotated).catch(() => false)) {
        rotated = `${dir}/usage-${new Date(row.at).toISOString().replace(/[:.]/g, '-').slice(0, 19)}.jsonl`
      }
      await host.write(rotated, body)
    } else if (size > 0) {
      existing = await host.read(path)
    }

    await host.write(path, existing + chunk)
  } catch {
    // fail-open: bookkeeping must never break a turn
  }
}

function gainOf(row: LedgerRow): UsageLine['gain'] {
  if ('purpose' in row && row.purpose === 'offload.result') {
    const offload = row as OffloadRow
    const removed = Math.max(0, offload.charsIn - offload.charsOut)

    return { tokensSaved: Math.round(removed / 4) }
  }

  if ('purpose' in row && row.purpose === 'route.decision') {
    const decision = row as DecisionRow
    const chosen = modelName(decision.chosen)
    const from = modelName(decision.fromModel ?? decision.heldModel ?? decision.runningModel ?? '')
    const chosenPrice = chosen === undefined ? undefined : PRICE_IN[chosen]
    const fromPrice = from === undefined ? undefined : PRICE_IN[from]
    if (chosenPrice === undefined || fromPrice === undefined || fromPrice === 0) return undefined

    return { priceRatio: chosenPrice / fromPrice }
  }

  return undefined
}

function modelName(value: string): string | undefined {
  const name = value.toLowerCase().split('/')[0]
  if (name === 'haiku' || name === 'sonnet' || name === 'opus') return name

  return undefined
}

function componentLine(component: Component, rows: readonly UsageLine[]): string {
  const n = rows.length
  const activations = `${n} ${n === 1 ? 'activation' : 'activations'}`
  const [applied, held] = appliedHeld(component, rows)
  const parts = [`${component}: ${activations}`]
  if (component === 'router' || component === 'compact' || component === 'tool-describe' || held > 0) {
    parts.push(`${applied} applied / ${held} held`)
  }

  if (component === 'offload') {
    const chars = rows.reduce((sum, row) => sum + ('charsIn' in row ? Math.max(0, row.charsIn - row.charsOut) : 0), 0)
    const tokens = rows.reduce((sum, row) => sum + (row.gain?.tokensSaved ?? 0), 0)
    parts.push(`${chars} chars trimmed`)
    parts.push(`${tokens} estimated tokens saved`)
  }

  return parts.join(' · ')
}

function appliedHeld(component: Component, rows: readonly UsageLine[]): [number, number] {
  if (component === 'router') {
    const applied = rows.filter(row => ('applied' in row && row.applied) || ('wouldApply' in row && row.wouldApply === true)).length

    return [applied, rows.length - applied]
  }

  if (component === 'compact') {
    const applied = rows.filter(row => ('fired' in row && row.fired) || ('wouldFire' in row && row.wouldFire === true)).length

    return [applied, rows.length - applied]
  }

  if (component === 'tool-describe') {
    const held = rows.filter(row => 'deferred' in row && row.deferred).length

    return [rows.length - held, held]
  }

  const held = rows.filter(row => 'shadow' in row && row.shadow === true).length

  return [rows.length - held, held]
}

function chosenCounts(rows: readonly UsageLine[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!('chosen' in row) || typeof row.chosen !== 'string') continue
    const name = modelName(row.chosen) ?? row.chosen
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function parseLines(text: string): UsageLine[] {
  const lines: UsageLine[] = []
  for (const raw of text.split('\n')) {
    if (raw === '') continue
    try {
      lines.push(JSON.parse(raw) as UsageLine)
    } catch {
      // skip a truncated or hand-edited line
    }
  }

  return lines
}
