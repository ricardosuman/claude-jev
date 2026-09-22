// Runs the evals/ cases headless with `claude -p`, once per arm, and appends one
// row per run to bench/results/<timestamp>/runs.jsonl (the stream of each run is
// kept next to it). Runs are sequential: the Jev ledger is shared.
//
//   bun bench/run.ts --arms A,B,C --cases 'debug-*' --runs 3 --model opus --effort medium --max-cost-usd 5 \
//     [--seed N] [--no-warmup] [--keep] [--max-weekly 93] [--max-five-hour 90]
//   bun bench/run.ts --resume bench/results/<timestamp> [--max-weekly N] [--max-five-hour N] [--max-cost-usd N]
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const ROOT = resolve(import.meta.dir, '..')
// plugin arms load a copy of just the plugin, so the agent can't reach evals/*/hidden.spec.ts through it; set in main()
let PLUGIN_DIR = ROOT
let COACH_PLUGIN_DIR: string | undefined
let workspace: string | undefined // the run in flight's scaffold dir, removed on exit (runs are sequential)

const ALLOWED_TOOLS = [
  'Read', 'Edit', 'Write', 'Glob', 'Grep',
  ...['bun test', 'bun run', 'ls', 'cat', 'git diff', 'git status'].map(prefix => `Bash(${prefix}:*)`),
]

// G/I add this module to the temporary plugin copy. It is deliberately a small,
// local rewrite: no Jev call, no new tool, and no extra user turn. The spec is
// made from at most 10 paths from find results/current text, four short
// invariant lines, a four-message tail, and one verification command.
const COACH_HOOK = String.raw`
import type { On, PluginOptions } from 'claude-code'
import { register as registerJev } from './register.ts'

const LEDGER_KEY = 'ledger'
const PATH_RE = /\b(?:[\w.-]+\/)+[\w.-]+\.(?:ts|tsx|js|jsx|json|md|yaml|yml|sh)\b/g
const INVARIANT_RE = /\b(?:must|should|always|never|exactly|without|preserve|invariant)\b|O\(/i
const COMMAND_RE = /\b(?:bun|npm|pnpm|yarn)\s+(?:test|run\s+[^\n]+)/i

const clip = (text: string, chars: number) => text.replace(/\s+/g, ' ').trim().slice(0, chars)
const unique = (items: string[]) => [...new Set(items.filter(Boolean))]
const pathsIn = (text: string) => [...text.matchAll(PATH_RE)].map(match => match[0])

const messageText = (message: { text: string; toolResults?: { text: string }[] }) =>
  [message.text, ...(message.toolResults ?? []).map(result => result.text)].filter(Boolean).join('\n')

const coachSpec = async ($: any, prompt: string): Promise<string> => {
  const [rawLedger, messages] = await Promise.all([$.store.get(LEDGER_KEY), $.session.messages()])
  const ledger = Array.isArray(rawLedger) ? rawLedger : []
  const recent = messages.slice(-4)
  const recentText = recent.map(messageText).join('\n')
  const ledgerPaths: string[] = []
  for (const row of ledger) {
    if (row?.purpose !== 'find.result' || !Array.isArray(row.paths)) continue
    const indices = Array.isArray(row.indices) ? row.indices : row.paths.map((_: unknown, index: number) => index)
    for (const index of indices) if (typeof row.paths[index] === 'string') ledgerPaths.push(row.paths[index])
  }
  const files = unique([...pathsIn(prompt), ...pathsIn(recentText), ...ledgerPaths]).slice(0, 10)
  const invariants = unique(
    recentText
      .split(/\r?\n/)
      .map(line => clip(line, 180))
      .filter(line => line.length > 0 && INVARIANT_RE.test(line)),
  ).slice(0, 4)
  const command = recentText.match(COMMAND_RE)?.[0] ?? 'bun test'
  const lines = [
    '[coach context]',
    'Files to inspect/touch (up to 10; inspect only what the assignment needs):',
    ...(files.length ? files.map(path => '- ' + path) : ['- derive the relevant paths from the assignment']),
    'Recent context (last four messages, clipped):',
    ...recent.map(message => '- ' + message.role + ': ' + clip(messageText(message), 240)),
    'Invariants extracted from that context:',
    ...(invariants.length ? invariants.map(invariant => '- ' + invariant) : ['- preserve existing behavior outside the bounded change']),
    'Verify with: ' + clip(command, 160),
    'Do the bounded task, then report files changed, checks run, and blockers.',
    '[end coach context]',
  ]

  return lines.join('\n')
}

// Exact interception point: on('agent.spawn', ...), restricted to the
// plugin-qualified lane type. The spec is a prompt prefix on the rewritten
// spawn, not a separate tool call or user-visible text message.
// The engine loads exactly one module from hooks.json's "modules": a second
// entry makes it load none. So this module is the only one listed, and it
// calls the real register itself.
export function register(on: On, options: PluginOptions = {}): void {
  registerJev(on, options)
  // The matcher is required, not decoration: register.ts already hooks
  // agent.spawn without one, and the engine refuses a module that registers
  // the same event twice unmatched.
  on('agent.spawn', { subagentType: 'jev:lane' }, async ($, e, next) => {
    const components = await $.env.get('JEV_COMPONENTS')
    if (!components?.split(',').some(name => name.trim() === 'coach')) return next(e)
    try {
      return next({ ...e, prompt: (await coachSpec($, e.prompt)) + '\n\n' + e.prompt })
    } catch {
      return next(e)
    }
  })
}
`

// JEV_COMPONENTS and JEV_MODELS are set only when an arm defines them
const ARMS: {
  name: string
  pluginDir: boolean
  components?: string
  models?: string
  allowedTools?: string[]
  coach?: boolean
  compact?: 'on'
  compactFromPct?: number
  compactToPct?: number
  compactMinTurns?: number
}[] = [
  { name: 'A', pluginDir: false },
  { name: 'B', pluginDir: true, components: 'none' },
  { name: 'C', pluginDir: true, components: 'router' },
  { name: 'D', pluginDir: true, components: 'router,offload' },
  { name: 'E', pluginDir: true, components: 'router,offload', models: 'haiku,opus' },
  { name: 'F', pluginDir: true, components: 'router,offload,lanes', allowedTools: [...ALLOWED_TOOLS, 'Task'] },
  { name: 'G', pluginDir: true, components: 'router,offload,lanes,coach', coach: true, allowedTools: [...ALLOWED_TOOLS, 'Task'] },
  { name: 'J', pluginDir: true, components: 'router,offload,find', allowedTools: [...ALLOWED_TOOLS, 'mcp__jev__jev-find'] },
  { name: 'H', pluginDir: true, components: 'router,offload,compact', compact: 'on', compactFromPct: 60, compactToPct: 85, compactMinTurns: 5 },
  {
    name: 'I',
    pluginDir: true,
    components: 'router,offload,lanes,coach,compact',
    coach: true,
    compact: 'on',
    compactFromPct: 60,
    compactToPct: 85,
    compactMinTurns: 5,
    allowedTools: [...ALLOWED_TOOLS, 'Task'],
  },
]

type Grader = { type: string; name: string; target?: { source: string; path: string } | string; pattern?: string; match?: string; path?: string; arm?: string; run?: string; timeout_seconds?: number }
export type Case = {
  name: string
  tags: string[]
  execution: { prompt: string; max_turns: number; timeout_seconds: number }
  graders: Grader[]
}

export const loadCase = (name: string): Case => Bun.YAML.parse(readFileSync(join(ROOT, 'evals', name, 'case.yaml'), 'utf8')) as Case

/** Scaffolds the case into a fresh temp dir (the case's scaffold.sh git-inits it). */
export async function scaffold(name: string): Promise<string> {
  const dir = (workspace = mkdtempSync(join(tmpdir(), `jev-bench-${name}-`)))
  const proc = Bun.spawn(['bash', join(ROOT, 'evals', name, 'scaffold.sh')], { cwd: dir, stdout: 'ignore', stderr: 'inherit' })
  if ((await proc.exited) !== 0) throw new Error(`scaffold failed for ${name}`)

  return dir
}

const tail = (text: string) => text.split('\n').slice(-20).join('\n')

/**
 * Every grader that applies without the plugin trace must pass; returns null when they do, else why the
 * first one failed. `with-only` graders are skipped: the plugin-load check on the init event (pluginError)
 * replaces them. A `command` grader runs `run` in the workspace with CASE_DIR set to the case's dir (where
 * hidden specs live); exit 0 within timeout_seconds (default 120) passes.
 */
export async function grade(c: Case, dir: string, answer: string): Promise<string | null> {
  for (const g of c.graders.filter(g => g.arm !== 'with-only')) {
    if (g.type === 'command') {
      const p = await spawnTimed(['bash', '-c', g.run!], dir, { ...process.env, CASE_DIR: join(ROOT, 'evals', c.name) }, (g.timeout_seconds ?? 120) * 1000)
      if (p.timedOut || p.code !== 0) return `${g.name}: ${p.timedOut ? 'timed out' : `exit ${p.code}`}\n${tail(p.stdout)}\n${tail(p.stderr)}`
    } else if (!passes(c, g, dir, answer)) return g.name
  }

  return null
}

function passes(c: Case, g: Grader, dir: string, answer: string): boolean {
  if (g.type === 'file_exists') return existsSync(join(dir, g.path ?? (g.target as { path: string }).path))
  if (g.type !== 'regex') throw new Error(`${c.name}: unsupported grader type ${g.type}`)
  const target = g.target
  const text =
    target === 'last_message'
      ? answer
      : typeof target === 'object' && target.source === 'file' && existsSync(join(dir, target.path))
        ? readFileSync(join(dir, target.path), 'utf8')
        : undefined
  if (text === undefined) return false
  const found = new RegExp(g.pattern!).test(text)

  return g.match === 'not_contains' ? !found : found
}

/** Why a run's loaded plugins don't match its arm, or null when they do. */
export function pluginError(plugins: string[], pluginDir: boolean): string | null {
  if (pluginDir && !plugins.includes('jev')) return 'jev not loaded'
  if (!pluginDir && plugins.includes('jev')) return 'jev loaded in a no-plugin arm'

  return null
}

// mulberry32: a seeded PRNG so an arm order can be reproduced with --seed
export function prng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }

  return out
}

type Tokens = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
// ponytail: Anthropic's price ratios (output 5x, cache read 0.1x, 1h cache write 2x — the CLI writes 1h
// entries); calibrating and estimating with the same weights keeps the estimate consistent.
const weighted = (u: Tokens) =>
  (u.input_tokens ?? 0) + 5 * (u.output_tokens ?? 0) + 0.1 * (u.cache_read_input_tokens ?? 0) + 2 * (u.cache_creation_input_tokens ?? 0)

type ModelUsage = Record<string, { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number; costUSD: number }>

/** $ per weighted token for each model of a finished run's result.modelUsage. */
export function ratesOf(modelUsage: ModelUsage): Record<string, number> {
  const rates: Record<string, number> = {}
  for (const [model, u] of Object.entries(modelUsage)) {
    const w = weighted({ input_tokens: u.inputTokens, output_tokens: u.outputTokens, cache_read_input_tokens: u.cacheReadInputTokens, cache_creation_input_tokens: u.cacheCreationInputTokens })
    if (w > 0) rates[model] = u.costUSD / w
  }

  return rates
}

/**
 * Cost of a run with no result event, from its streamed assistant messages priced at earlier runs' rates;
 * null when a model has no rate yet or nothing was streamed. A lower bound: a streamed message's
 * output_tokens is counted before the message ends.
 */
export function estimateCost(events: any[], rates: Record<string, number>): number | null {
  const messages = new Map<string, { model: string; usage: Tokens }>()
  for (const e of events) if (e.type === 'assistant' && e.message?.id) messages.set(e.message.id, e.message) // last copy of each message
  if (!messages.size) return null
  let cost = 0
  for (const m of messages.values()) {
    const rate = rates[m.model]
    if (rate === undefined) return null
    cost += rate * weighted(m.usage)
  }

  return cost
}

const claude = (args: string[], cwd: string, env: Record<string, string | undefined>, timeoutMs: number) => spawnTimed(['claude', ...args], cwd, env, timeoutMs)

const groups = new Set<number>() // live process groups, killed on exit too: being detached, they miss the terminal's Ctrl-C
const killGroup = (pid: number) => { try { process.kill(-pid, 'SIGKILL') } catch {} } // the group may already be gone

/** Runs `cmd` in its own process group; on timeout the whole group is killed, so no grandchild outlives it. */
async function spawnTimed(cmd: string[], cwd: string, env: Record<string, string | undefined>, timeoutMs: number) {
  const proc = Bun.spawn(cmd, { cwd, env, stdout: 'pipe', stderr: 'pipe', detached: true })
  groups.add(proc.pid)
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    killGroup(proc.pid)
  }, timeoutMs)
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  clearTimeout(timer)
  groups.delete(proc.pid)

  return { stdout, stderr, code, timedOut }
}

type Arm = (typeof ARMS)[number]
type Options = { model: string; effort: string }

const settingsOf = (arm: Arm): string | undefined => {
  if (arm.compact !== 'on') return undefined

  return JSON.stringify({
    pluginConfigs: {
      jev: {
        options: {
          compact: arm.compact,
          compactFromPct: arm.compactFromPct ?? 60,
          compactToPct: arm.compactToPct ?? 85,
          compactMinTurns: arm.compactMinTurns ?? 5,
        },
      },
    },
  })
}

const envOf = (arm: Arm) => {
  const env: Record<string, string | undefined> = { ...process.env, CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: '1' }
  delete env.JEV_COMPONENTS
  delete env.JEV_MODELS
  if (arm.components !== undefined) env.JEV_COMPONENTS = arm.components
  if (arm.models !== undefined) env.JEV_MODELS = arm.models

  return env
}

// isolation from the operator's user settings (plugins, hooks, CLAUDE.md) and claude.ai MCP servers
const commonOf = (arm: Arm) => [
  '--setting-sources', 'project,local', '--strict-mcp-config',
  ...(arm.pluginDir ? ['--plugin-dir', arm.coach ? COACH_PLUGIN_DIR! : PLUGIN_DIR] : []),
  ...(settingsOf(arm) === undefined ? [] : ['--settings', settingsOf(arm)!]),
]

/** Scaffolds the case and runs it once in the arm; the caller grades and removes `dir`. */
async function runOnce(c: Case, arm: Arm, o: Options) {
  const dir = await scaffold(c.name)
  const startedAt = Date.now()
  const run = await claude(
    [
      '-p', c.execution.prompt, '--output-format', 'stream-json', '--verbose',
      '--model', o.model, '--effort', o.effort, '--max-turns', String(c.execution.max_turns),
      '--permission-mode', 'acceptEdits', ...commonOf(arm),
      '--allowedTools', ...(arm.allowedTools ?? ALLOWED_TOOLS), // variadic: keep it last
    ],
    dir, envOf(arm), c.execution.timeout_seconds * 1000,
  )
  const events = run.stdout.split('\n').flatMap(line => { try { return [JSON.parse(line)] } catch { return [] } })

  return { ...run, dir, startedAt, events, result: events.findLast(e => e.type === 'result') }
}

/** Latest weekly and 5-hour plan usage (percent) reported in a run's stream; null when it reports none. */
export function usageOf(events: any[]): { weekly: number | null; fiveHour: number | null } {
  let weekly: number | null = null
  let fiveHour: number | null = null
  for (const e of events) {
    if (e.type !== 'rate_limit_event') continue
    const info = e.rate_limit_info ?? {}
    const pct = (window: string) => info.unifiedWindows?.[window]?.utilization ?? (info.rateLimitType === window ? info.utilization : undefined)
    weekly = pct('seven_day') === undefined ? weekly : 100 * pct('seven_day')
    fiveHour = pct('five_hour') === undefined ? fiveHour : 100 * pct('five_hour')
  }

  return { weekly, fiveHour }
}

type RateLimitWindow = 'five_hour' | 'seven_day'

const resetAtOf = (events: any[], window: RateLimitWindow): unknown => {
  let resetAt: unknown
  for (const e of events) {
    if (e.type !== 'rate_limit_event') continue
    const info = e.rate_limit_info ?? {}
    const candidate = info.unifiedWindows?.[window]?.resetsAt ?? (info.rateLimitType === window ? info.resetsAt : undefined)
    if (candidate !== undefined) resetAt = candidate
  }

  return resetAt
}

const resetText = (resetAt: unknown) => {
  if (resetAt === undefined || resetAt === null) return ''
  const number = typeof resetAt === 'number' ? resetAt : Number(resetAt)
  const date = Number.isFinite(number)
    ? new Date(number < 1e12 ? number * 1000 : number)
    : new Date(String(resetAt))
  if (Number.isNaN(date.getTime())) return ''

  return `; resets ${date.toISOString()}`
}

// The CLI's exhausted-session message is stable and includes a reset clause; requiring both
// that message and the no-turn/no-tool shape keeps an ordinary failed answer from being invalidated.
const SESSION_LIMIT = /You've hit your session limit\s*·\s*resets\b[^\r\n]*/

const toolsOf = (events: any[]) => {
  const tools: Record<string, number> = {}
  for (const e of events) {
    if (e.type !== 'assistant') continue
    for (const block of e.message?.content ?? []) if (block.type === 'tool_use') tools[block.name] = (tools[block.name] ?? 0) + 1
  }

  return tools
}

const isSessionLimit = (stdout: string, stderr: string, result: any, tools: Record<string, number>) => {
  const outputCarriesLimit = SESSION_LIMIT.test(`${stdout}\n${stderr}`)
  const resultCarriesLimit = !result || (typeof result.result === 'string' && SESSION_LIMIT.test(result.result))
  const turns = result?.num_turns ?? 0

  return outputCarriesLimit && resultCarriesLimit && turns <= 1 && Object.keys(tools).length === 0
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)]

async function main() {
  const { values: cli } = parseArgs({
    options: {
      resume: { type: 'string' },
      'max-weekly': { type: 'string' },
      'max-five-hour': { type: 'string' },
      arms: { type: 'string', default: 'A,B,C' },
      cases: { type: 'string', default: '*' },
      runs: { type: 'string', default: '3' },
      model: { type: 'string', default: 'opus' },
      effort: { type: 'string', default: 'medium' },
      'max-cost-usd': { type: 'string' },
      seed: { type: 'string' },
      'no-warmup': { type: 'boolean', default: false },
      keep: { type: 'boolean', default: false },
    },
  })
  // a resumed bench keeps its seed and original args; only the two caps may be overridden
  const state = cli.resume ? JSON.parse(readFileSync(join(cli.resume, 'state.json'), 'utf8')) : undefined
  const values = { ...cli, ...state?.args }
  const cap = Number(cli['max-cost-usd'] ?? state?.args['max-cost-usd'] ?? 5)
  const maxWeekly = Number(cli['max-weekly'] ?? state?.args['max-weekly'] ?? 93)
  const maxFiveHour = Number(cli['max-five-hour'] ?? state?.args['max-five-hour'] ?? 90)
  const arms = values.arms.split(',').map(name => ARMS.find(a => a.name === name) ?? (() => { throw new Error(`unknown arm ${name}`) })())
  const glob = new Bun.Glob(values.cases)
  const cases = readdirSync(join(ROOT, 'evals'))
    .filter(name => glob.match(name) && existsSync(join(ROOT, 'evals', name, 'case.yaml')))
    .sort()
    .map(loadCase)
  if (!cases.length) throw new Error(`no case matches ${values.cases}`)
  PLUGIN_DIR = mkdtempSync(join(tmpdir(), 'jev-plugin-'))
  for (const part of ['.claude-plugin', 'hooks', 'types']) cpSync(join(ROOT, part), join(PLUGIN_DIR, part), { recursive: true })
  if (arms.some(arm => arm.coach)) {
    COACH_PLUGIN_DIR = mkdtempSync(join(tmpdir(), 'jev-coach-plugin-'))
    for (const part of ['.claude-plugin', 'hooks', 'types']) cpSync(join(ROOT, part), join(COACH_PLUGIN_DIR, part), { recursive: true })
    writeFileSync(join(COACH_PLUGIN_DIR, 'hooks', 'coach.ts'), COACH_HOOK)
    const hooksPath = join(COACH_PLUGIN_DIR, 'hooks', 'hooks.json')
    const hooks = JSON.parse(readFileSync(hooksPath, 'utf8')) as { modules?: string[] }
    hooks.modules = ['./coach.ts'] // one module only: the engine loads none when two are listed
    writeFileSync(hooksPath, JSON.stringify(hooks))
  }
  // A plugin the engine refuses loads nothing and says nothing: the arm then
  // measures plain Opus and looks like a costly component. Fail loudly here.
  for (const dir of [PLUGIN_DIR, COACH_PLUGIN_DIR]) {
    if (!dir) continue
    const check = Bun.spawnSync(['claude', 'plugin', 'validate', dir])
    if (check.exitCode !== 0) throw new Error(`plugin does not validate in ${dir}:\n${check.stdout.toString()}${check.stderr.toString()}`)
  }
  process.on('exit', () => {
    groups.forEach(killGroup)
    for (const path of [PLUGIN_DIR, COACH_PLUGIN_DIR, workspace]) if (path) rmSync(path, { recursive: true, force: true })
  })
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => process.exit(130)) // so the exit hook runs
  const o: Options = { model: values.model, effort: values.effort }
  const seed: number = state?.seed ?? (values.seed === undefined ? Date.now() % 2 ** 32 : Number(values.seed))
  const random = prng(seed)
  const out = cli.resume ?? join(ROOT, 'bench', 'results', new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(out, { recursive: true })
  const args = state?.args ?? { ...cli, seed: String(seed) }
  writeFileSync(join(out, 'state.json'), JSON.stringify({ seed, args }))
  const rows = existsSync(join(out, 'runs.jsonl')) ? readFileSync(join(out, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : []
  const done = new Set(rows.map(row => `${row.case}.${row.arm}.${row.run}`))
  console.log(`${out}\nseed ${seed}${done.size ? `, resuming: ${done.size} runs done` : ''}`)
  type Usage = ReturnType<typeof usageOf>
  const cleanStop = (after: string, usage: Usage, message?: string) => {
    writeFileSync(join(out, 'state.json'), JSON.stringify({ seed, args, stoppedAt: new Date().toISOString(), after, weekly: usage.weekly, fiveHour: usage.fiveHour }))
    if (message) console.log(message)
  }
  /** Stops the bench (exit 0) once either plan window reaches its cap, leaving state.json to resume from. */
  const usageCapped = (after: string, events: any[], usage: Usage) => {
    const hit = [
      { name: 'weekly', value: usage.weekly, cap: maxWeekly, resetAt: resetAtOf(events, 'seven_day') },
      { name: 'five-hour', value: usage.fiveHour, cap: maxFiveHour, resetAt: resetAtOf(events, 'five_hour') },
    ].find(window => window.value !== null && window.value >= window.cap)
    if (!hit) return false

    cleanStop(after, usage)
    console.log(`stopped: ${hit.name} usage ${hit.value!.toFixed(0)}% ≥ ${hit.cap}%${resetText(hit.resetAt)}; resume with --resume ${out}`)
    return true
  }
  let spent = 0
  let rates: Record<string, number> = {}
  const capped = () => spent >= cap && (console.log(`cap reached: $${spent.toFixed(4)} >= $${cap}, stopping`), true)

  for (const c of cases) {
    const costs: number[] = [] // this case's known costs, the spend-cap fallback for a run with no cost
    // warm-up: one discarded arm-A run writes the shared system prefix to the prompt cache, so no measured arm pays that cold write
    const left = Array.from({ length: Number(values.runs) }, (_, i) => arms.map(a => `${c.name}.${a.name}.${i + 1}`)).flat().some(id => !done.has(id))
    if (!values['no-warmup'] && left) {
      if (capped()) return
      const warm = await runOnce(c, ARMS.find(a => a.name === 'A')!, o)
      const warmUsage = usageOf(warm.events)
      if (isSessionLimit(warm.stdout, warm.stderr, warm.result, toolsOf(warm.events))) {
        rmSync(warm.dir, { recursive: true, force: true })
        workspace = undefined
        cleanStop(`${c.name}.warm-up`, warmUsage, `invalid: ${c.name}.warm-up hit the session limit`)
        return
      }
      rmSync(warm.dir, { recursive: true, force: true })
      workspace = undefined
      if (warm.result?.modelUsage) rates = { ...rates, ...ratesOf(warm.result.modelUsage) }
      spent += warm.result?.total_cost_usd ?? estimateCost(warm.events, rates) ?? 0
      console.log(`warm-up ${c.name} (A, discarded): $${(warm.result?.total_cost_usd ?? 0).toFixed(4)} (spent $${spent.toFixed(4)})`)
      if (usageCapped(`${c.name}.warm-up`, warm.events, warmUsage)) return
    }
    for (let run = 1; run <= Number(values.runs); run++) {
      for (const [order, arm] of shuffled(arms, random).entries()) { // shuffled even when done, so the order matches the original
        const id = `${c.name}.${arm.name}.${run}`
        if (done.has(id)) continue
        if (capped()) return
        const r = await runOnce(c, arm, o)
        const { dir, events, result } = r
        const streamPath = join(out, `${id}.jsonl`)
        writeFileSync(streamPath, r.stdout)
        const init = events.find(e => e.type === 'system' && e.subtype === 'init')
        const plugins: string[] = init?.plugins?.map((p: { name: string }) => p.name) ?? []
        const loadError = pluginError(plugins, arm.pluginDir)
        const tools = toolsOf(events)
        const windowUsage = usageOf(events)
        if (isSessionLimit(r.stdout, r.stderr, result, tools)) {
          rmSync(streamPath, { force: true })
          rmSync(dir, { recursive: true, force: true })
          workspace = undefined
          cleanStop(id, windowUsage, `invalid: ${id} hit the session limit`)
          return
        }
        const answer = typeof result?.result === 'string' ? result.result : ''
        const tests = Bun.spawn(['bun', 'test'], { cwd: dir, stdout: 'ignore', stderr: 'ignore' })
        const testsPass = (await tests.exited) === 0
        let jev: unknown[] | null = null
        if (arm.pluginDir) {
          const ledger = await claude(['-p', '/jev json', '--output-format', 'json', ...commonOf(arm)], dir, envOf(arm), 60_000)
          try {
            const text: string = JSON.parse(ledger.stdout).result
            jev = (JSON.parse(text.slice(text.indexOf('['))) as { at: number }[]).filter(row => row.at >= r.startedAt)
          } catch {} // no /jev json in this build of the mod: jev stays null
        }
        if (result?.modelUsage) rates = { ...rates, ...ratesOf(result.modelUsage) }
        const costUsd: number | null = result?.total_cost_usd ?? estimateCost(events, rates)
        const usage = result?.usage ?? {}
        const gradeError = !r.timedOut && !loadError && result ? await grade(c, dir, answer) : null
        const row = {
          case: c.name,
          tier: c.tags[0],
          arm: arm.name,
          components: arm.components,
          models: arm.models,
          run,
          order,
          seed,
          model: o.model,
          effort: o.effort,
          pass: !r.timedOut && !loadError && !!result && gradeError === null,
          timedOut: r.timedOut,
          testsPass,
          costUsd,
          durationMs: result?.duration_ms ?? Date.now() - r.startedAt,
          turns: result?.num_turns ?? 0,
          usage: {
            input: usage.input_tokens ?? 0,
            output: usage.output_tokens ?? 0,
            cacheRead: usage.cache_read_input_tokens ?? 0,
            cacheWrite: usage.cache_creation_input_tokens ?? 0,
          },
          modelUsage: result?.modelUsage ?? {},
          tools,
          denials: result?.permission_denials?.length ?? 0,
          plugins,
          jev,
          weekly: windowUsage.weekly,
          fiveHour: windowUsage.fiveHour,
          error: loadError ?? (r.timedOut ? 'timeout' : result ? (result.is_error ? result.subtype : gradeError) : `exit ${r.code}: ${r.stderr.slice(-500)}`),
        }
        if (costUsd !== null) costs.push(costUsd)
        spent += costUsd ?? median(costs) ?? 0
        appendFileSync(join(out, 'runs.jsonl'), JSON.stringify(row) + '\n')
        console.log(
          `${id} [order ${order}]: ${row.pass ? 'pass' : 'FAIL'}${row.error ? ` (${row.error})` : ''} tests=${testsPass} ` +
            `${costUsd === null ? '$?' : `$${costUsd.toFixed(4)}`} turns=${row.turns} (spent $${spent.toFixed(4)})`,
        )
        if (values.keep) console.log(`  kept ${dir}`)
        else rmSync(dir, { recursive: true, force: true })
        workspace = undefined // kept or removed: the exit hook leaves it alone
        if (usageCapped(id, events, windowUsage)) return
      }
    }
  }
}

if (import.meta.main) await main()
