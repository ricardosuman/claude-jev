export type BinsConfig = {
  bucket: string
  region: string
  prefix: string
  windowSec: number
}

export const BINS_MAX_KEYS = 1000

/**
 * Keys:
 * BINS_BUCKET — bucket ('lodge-local')
 * BINS_REGION — region ('local')
 * BINS_PREFIX — prefix ('dev/')
 * BINS_SIGNED_WINDOW_SEC — windowSec (90)
 */
export function loadBins(env: Record<string, string | undefined> = process.env): BinsConfig {
  return {
    bucket: env.BINS_BUCKET ?? 'lodge-local',
    region: env.BINS_REGION ?? 'local',
    prefix: env.BINS_PREFIX ?? 'dev/',
    windowSec: Number(env.BINS_SIGNED_WINDOW_SEC ?? 90),
  }
}

export function freezeBinsConfig(cfg: BinsConfig): Readonly<BinsConfig> {
  return Object.freeze({ ...cfg })
}

export function describeBinsConfig(cfg: BinsConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeBinsConfig(base: BinsConfig, patch: Partial<BinsConfig>): BinsConfig {
  return { ...base, ...patch }
}

export function pickBinsConfig<K extends keyof BinsConfig>(cfg: BinsConfig, keys: K[]): Pick<BinsConfig, K> {
  const out = {} as Pick<BinsConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
