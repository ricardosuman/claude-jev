export type LimitsConfig = {
  catalogPageSize: number
  uploadMb: number
  noteMax: number
  windowItems: number
}

export const HARD_ITEM_CAP = 10_000

/**
 * Environment keys:
 * CATALOG_PAGE_SIZE — catalogPageSize (default 20)
 * UPLOAD_MB — uploadMb (default 8)
 * NOTE_MAX — noteMax (default 4000)
 * LIMIT_WINDOW_ITEMS — windowItems (default 500)
 */
export function loadLimits(env: Record<string, string | undefined> = process.env): LimitsConfig {
  return {
    catalogPageSize: Number(env.CATALOG_PAGE_SIZE ?? 20),
    uploadMb: Number(env.UPLOAD_MB ?? 8),
    noteMax: Number(env.NOTE_MAX ?? 4000),
    windowItems: Number(env.LIMIT_WINDOW_ITEMS ?? 500),
  }
}

export function freezeLimitsConfig(cfg: LimitsConfig): Readonly<LimitsConfig> {
  return Object.freeze({ ...cfg })
}

export function describeLimitsConfig(cfg: LimitsConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeLimitsConfig(base: LimitsConfig, patch: Partial<LimitsConfig>): LimitsConfig {
  return { ...base, ...patch }
}

export function pickLimitsConfig<K extends keyof LimitsConfig>(cfg: LimitsConfig, keys: K[]): Pick<LimitsConfig, K> {
  const out = {} as Pick<LimitsConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
