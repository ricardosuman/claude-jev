export type ScratchConfig = {
  url: string
  ttlSec: number
  prefix: string
  windowSec: number
}

export const SCRATCH_NULL_TTL_SEC = 5

/**
 * Keys:
 * SCRATCH_URL — url ('memory://scratch')
 * SCRATCH_TTL_SEC — ttlSec (60)
 * SCRATCH_PREFIX — prefix ('ldg')
 * SCRATCH_WINDOW_SEC — windowSec (15)
 */
export function loadScratch(env: Record<string, string | undefined> = process.env): ScratchConfig {
  return {
    url: env.SCRATCH_URL ?? 'memory://scratch',
    ttlSec: Number(env.SCRATCH_TTL_SEC ?? 60),
    prefix: env.SCRATCH_PREFIX ?? 'ldg',
    windowSec: Number(env.SCRATCH_WINDOW_SEC ?? 15),
  }
}

export function freezeScratchConfig(cfg: ScratchConfig): Readonly<ScratchConfig> {
  return Object.freeze({ ...cfg })
}

export function describeScratchConfig(cfg: ScratchConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeScratchConfig(base: ScratchConfig, patch: Partial<ScratchConfig>): ScratchConfig {
  return { ...base, ...patch }
}

export function pickScratchConfig<K extends keyof ScratchConfig>(cfg: ScratchConfig, keys: K[]): Pick<ScratchConfig, K> {
  const out = {} as Pick<ScratchConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
