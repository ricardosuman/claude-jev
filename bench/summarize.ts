// Per-arm (and per arm × tier) tables for a bench/run.ts results file: pass rate,
// cost per passing run, median/p90 of cost, tokens, duration and turns, cache hit
// rate, models used, Jev calls and routing decisions. Deltas are vs arm A. Below 10
// runs the spread is min/max, not p90. A null cost (a timeout with no estimate) is
// left out of the cost figures; timeouts count as failures.
//
//   bun bench/summarize.ts bench/results/<timestamp>/runs.jsonl
import { readFileSync } from 'fs'

type Row = {
  case: string
  tier: string
  arm: string
  model: string
  effort?: string
  pass: boolean
  timedOut?: boolean
  testsPass: boolean
  costUsd: number | null
  durationMs: number
  turns: number
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number }
  modelUsage: Record<string, { costUSD?: number }>
  jev: { purpose?: string; ok?: boolean; latencyMs?: number; usage?: { input_tokens: number; output_tokens: number }; chosen?: string; applied?: boolean }[] | null
}

const METRICS = ['costUsd', 'input', 'output', 'cacheRead', 'cacheWrite', 'durationMs', 'turns'] as const
const metric = (r: Row, m: (typeof METRICS)[number]): number | null => (m in r.usage ? r.usage[m as keyof Row['usage']] : (r[m as keyof Row] as number | null))
const valuesOf = (rows: Row[], m: (typeof METRICS)[number]) => rows.map(r => metric(r, m)).filter((v): v is number => v !== null)

// nearest-rank percentile over a sorted copy
function percentile(values: number[], p: number): number | undefined {
  const sorted = [...values].sort((a, b) => a - b)

  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
const fmt = (m: string, n: number | undefined) =>
  n === undefined || Number.isNaN(n) ? '-' : m === 'costUsd' || m === 'cost/pass' ? `$${n.toFixed(4)}` : m.endsWith('%') ? `${n.toFixed(1)}%` : String(Math.round(n))
const delta = (n: number | undefined, base: number | undefined) =>
  n === undefined || !base || Number.isNaN(n) || Number.isNaN(base) ? '' : `${n >= base ? '+' : ''}${((100 * (n - base)) / base).toFixed(1)}%`

function headline(rows: Row[]): Record<string, number> {
  const passed = rows.filter(r => r.pass).length
  const hit = sum(rows.map(r => r.usage.cacheRead)) / sum(rows.map(r => r.usage.cacheRead + r.usage.cacheWrite + r.usage.input))

  return { 'pass %': (100 * passed) / rows.length, 'cost/pass': passed ? sum(valuesOf(rows, 'costUsd')) / passed : NaN, 'cache hit %': 100 * hit }
}

function table(label: string, rows: Row[], base: Row[] | undefined) {
  const setups = [...new Set(rows.map(r => `${r.model}/${r.effort ?? '-'}`))].join(', ')
  const small = rows.length < 10
  console.log(
    `\n${label} (${setups}): ${rows.length} runs, ${rows.filter(r => r.pass).length} passed, timeouts ${rows.filter(r => r.timedOut).length}, bun test green in ${rows.filter(r => r.testsPass).length}`,
  )
  console.log(`${'metric'.padEnd(14)}${'median'.padStart(12)}${(small ? 'min..max' : 'p90').padStart(22)}${'Δ vs A'.padStart(10)}`)
  const baseHead = base && headline(base)
  for (const [m, v] of Object.entries(headline(rows))) console.log(`${m.padEnd(14)}${fmt(m, v).padStart(12)}${''.padStart(22)}${delta(v, baseHead?.[m]).padStart(10)}`)
  for (const m of METRICS) {
    const values = valuesOf(rows, m)
    const median = percentile(values, 50)
    const baseMedian = base && percentile(valuesOf(base, m), 50)
    const spread = small ? `${fmt(m, percentile(values, 0))}..${fmt(m, percentile(values, 100))}` : fmt(m, percentile(values, 90))
    console.log(`${m.padEnd(14)}${fmt(m, median).padStart(12)}${spread.padStart(22)}${delta(median, baseMedian).padStart(10)}`)
  }

  const models: Record<string, number> = {}
  for (const r of rows) for (const [model, u] of Object.entries(r.modelUsage)) models[model] = (models[model] ?? 0) + (u.costUSD ?? 0)
  const total = sum(Object.values(models))
  console.log(`models (cost share): ${Object.entries(models).map(([m, c]) => `${m} ${((100 * c) / total).toFixed(0)}%`).join(', ') || '-'}`)

  if (!rows.some(r => r.jev)) return
  const ledger = rows.flatMap(r => r.jev ?? [])
  const calls = ledger.filter(row => row.latencyMs !== undefined)
  const tokens = (k: 'input_tokens' | 'output_tokens') => sum(calls.map(c => c.usage?.[k] ?? 0))
  console.log(
    `jev: ${calls.length} calls (${calls.filter(c => c.ok).length} ok), p50 ${fmt('ms', percentile(calls.map(c => c.latencyMs!), 50))} ms, tokens ${tokens('input_tokens')} in / ${tokens('output_tokens')} out`,
  )
  const decisions = ledger.filter(row => row.purpose === 'route.decision')
  const chosen: Record<string, number> = {}
  for (const d of decisions) chosen[d.chosen!] = (chosen[d.chosen!] ?? 0) + 1
  const applied = decisions.length ? `${((100 * decisions.filter(d => d.applied).length) / decisions.length).toFixed(0)}%` : '-'
  console.log(`routing: ${decisions.length} decisions, ${applied} applied; chosen ${Object.entries(chosen).map(([k, n]) => `${k} ×${n}`).join(', ') || '-'}`)
}

const path = process.argv[2]
if (!path) throw new Error('usage: bun bench/summarize.ts <runs.jsonl>')
const rows: Row[] = readFileSync(path, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
const arms = [...new Set(rows.map(r => r.arm))].sort()
const tiers = [...new Set(rows.map(r => r.tier))].sort()
const baseOf = (tier?: string) => {
  const base = rows.filter(r => r.arm === 'A' && (!tier || r.tier === tier))

  return base.length ? base : undefined
}

for (const arm of arms) table(`arm ${arm}`, rows.filter(r => r.arm === arm), arm === 'A' ? undefined : baseOf())
if (tiers.length > 1)
  for (const tier of tiers)
    for (const arm of arms) table(`arm ${arm} × ${tier}`, rows.filter(r => r.arm === arm && r.tier === tier), arm === 'A' ? undefined : baseOf(tier))
