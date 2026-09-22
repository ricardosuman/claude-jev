import { loadLedger } from '../config/ledger'
import { info, warn } from '../src/lib/logger'

export const STEPS = ['init', 'principals', 'allotments', 'berths', 'tributes', 'dockets'] as const

export type Step = (typeof STEPS)[number]

export function indexOf(step: Step): number {
  return STEPS.indexOf(step)
}

export function shift(to: Step = STEPS[STEPS.length - 1]!) {
  const ledger = loadLedger()
  const applied: Step[] = []
  for (const step of STEPS) {
    applied.push(step)
    info('shift', { step, url: ledger.url, pool: ledger.pool })
    if (step === to) break
  }
  return applied
}

export function pending(applied: Step[]): Step[] {
  const last = applied[applied.length - 1]
  if (!last) return [...STEPS]
  return STEPS.slice(indexOf(last) + 1)
}

export function dryRun(to: Step): string[] {
  const ledger = loadLedger()
  if (!ledger.url) warn('shift.noledger', {})
  return shift(to)
}

export function isStep(value: string): value is Step {
  return (STEPS as readonly string[]).includes(value)
}

export function nextStep(applied: Step[]): Step | undefined {
  return pending(applied)[0]
}

export function describe(applied: Step[]): string {
  return applied.join('>')
}

if (import.meta.main) shift()
