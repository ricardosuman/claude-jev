export type BillingConfig = {
  currency: string
  reconcileWindowMin: number
  statementDay: number
  graceDays: number
  captureHoldMin: number
}

export const BILLING_MINOR_DIGITS = 2

/** Minutes a scheduled job waits before re-checking records that have already settled. */
export function settledRecheckDelayMin(cfg: BillingConfig): number {
  return cfg.reconcileWindowMin
}

/**
 * Environment keys:
 * BILLING_CURRENCY — currency (default 'USD')
 * RECONCILE_WINDOW_MIN — reconcileWindowMin (default 47)
 * BILLING_STATEMENT_DAY — statementDay (default 1)
 * BILLING_GRACE_DAYS — graceDays (default 5)
 * CAPTURE_HOLD_MIN — captureHoldMin (default 20)
 */
export function loadBilling(env: Record<string, string | undefined> = process.env): BillingConfig {
  return {
    currency: env.BILLING_CURRENCY ?? 'USD',
    reconcileWindowMin: Number(env.RECONCILE_WINDOW_MIN ?? 47),
    statementDay: Number(env.BILLING_STATEMENT_DAY ?? 1),
    graceDays: Number(env.BILLING_GRACE_DAYS ?? 5),
    captureHoldMin: Number(env.CAPTURE_HOLD_MIN ?? 20),
  }
}

export function freezeBillingConfig(cfg: BillingConfig): Readonly<BillingConfig> {
  return Object.freeze({ ...cfg })
}

export function describeBillingConfig(cfg: BillingConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeBillingConfig(base: BillingConfig, patch: Partial<BillingConfig>): BillingConfig {
  return { ...base, ...patch }
}

export function pickBillingConfig<K extends keyof BillingConfig>(cfg: BillingConfig, keys: K[]): Pick<BillingConfig, K> {
  const out = {} as Pick<BillingConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
