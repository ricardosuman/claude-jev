export type TributeConfig = {
  currency: string
  graceDays: number
  captureHoldMin: number
  statementDay: number
}

export const TRIBUTE_MINOR_DIGITS = 2

/**
 * Keys:
 * TRIBUTE_CURRENCY — currency ('USD')
 * TRIBUTE_GRACE_DAYS — graceDays (5)
 * TRIBUTE_CAPTURE_HOLD_MIN — captureHoldMin (20)
 * TRIBUTE_STATEMENT_DAY — statementDay (1)
 */
export function loadTribute(env: Record<string, string | undefined> = process.env): TributeConfig {
  return {
    currency: env.TRIBUTE_CURRENCY ?? 'USD',
    graceDays: Number(env.TRIBUTE_GRACE_DAYS ?? 5),
    captureHoldMin: Number(env.TRIBUTE_CAPTURE_HOLD_MIN ?? 20),
    statementDay: Number(env.TRIBUTE_STATEMENT_DAY ?? 1),
  }
}

export function freezeTributeConfig(cfg: TributeConfig): Readonly<TributeConfig> {
  return Object.freeze({ ...cfg })
}

export function describeTributeConfig(cfg: TributeConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeTributeConfig(base: TributeConfig, patch: Partial<TributeConfig>): TributeConfig {
  return { ...base, ...patch }
}

export function pickTributeConfig<K extends keyof TributeConfig>(cfg: TributeConfig, keys: K[]): Pick<TributeConfig, K> {
  const out = {} as Pick<TributeConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
