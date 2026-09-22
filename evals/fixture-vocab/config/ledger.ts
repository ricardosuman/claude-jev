export type LedgerConfig = {
  url: string
  pool: number
  slowMs: number
  ssl: boolean
}

export const SHIFT_TABLE = 'schema_shifts'

/**
 * Keys:
 * LEDGER_URL — url ('memory://lodge')
 * LEDGER_POOL — pool (5)
 * LEDGER_SLOW_MS — slowMs (200)
 * LEDGER_SSL — ssl (false)
 */
export function loadLedger(env: Record<string, string | undefined> = process.env): LedgerConfig {
  return {
    url: env.LEDGER_URL ?? 'memory://lodge',
    pool: Number(env.LEDGER_POOL ?? 5),
    slowMs: Number(env.LEDGER_SLOW_MS ?? 200),
    ssl: env.LEDGER_SSL === '1' || env.LEDGER_SSL === 'true' ? true : env.LEDGER_SSL === '0' || env.LEDGER_SSL === 'false' ? false : false,
  }
}

export function freezeLedgerConfig(cfg: LedgerConfig): Readonly<LedgerConfig> {
  return Object.freeze({ ...cfg })
}

export function describeLedgerConfig(cfg: LedgerConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeLedgerConfig(base: LedgerConfig, patch: Partial<LedgerConfig>): LedgerConfig {
  return { ...base, ...patch }
}

export function pickLedgerConfig<K extends keyof LedgerConfig>(cfg: LedgerConfig, keys: K[]): Pick<LedgerConfig, K> {
  const out = {} as Pick<LedgerConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
