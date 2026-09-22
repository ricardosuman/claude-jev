export type AllotmentConfig = {
  unwindDwellMin: number
  holdMin: number
  lapseDays: number
  countersignDay: number
}

export const ALLOTMENT_CAP = 10_000

export function unwindDwell(cfg: AllotmentConfig): number {
  return cfg.unwindDwellMin
}

/**
 * Keys:
 * UNWIND_DWELL_MIN — unwindDwellMin (73)
 * ALLOTMENT_HOLD_MIN — holdMin (20)
 * ALLOTMENT_LAPSE_DAYS — lapseDays (5)
 * ALLOTMENT_COUNTERSIGN_DAY — countersignDay (1)
 */
export function loadAllotment(env: Record<string, string | undefined> = process.env): AllotmentConfig {
  return {
    unwindDwellMin: Number(env.UNWIND_DWELL_MIN ?? 73),
    holdMin: Number(env.ALLOTMENT_HOLD_MIN ?? 20),
    lapseDays: Number(env.ALLOTMENT_LAPSE_DAYS ?? 5),
    countersignDay: Number(env.ALLOTMENT_COUNTERSIGN_DAY ?? 1),
  }
}

export function freezeAllotmentConfig(cfg: AllotmentConfig): Readonly<AllotmentConfig> {
  return Object.freeze({ ...cfg })
}

export function describeAllotmentConfig(cfg: AllotmentConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeAllotmentConfig(base: AllotmentConfig, patch: Partial<AllotmentConfig>): AllotmentConfig {
  return { ...base, ...patch }
}

export function pickAllotmentConfig<K extends keyof AllotmentConfig>(cfg: AllotmentConfig, keys: K[]): Pick<AllotmentConfig, K> {
  const out = {} as Pick<AllotmentConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
