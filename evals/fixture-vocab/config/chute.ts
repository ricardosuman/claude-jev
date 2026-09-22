export type ChuteConfig = {
  url: string
  visibilitySec: number
  windowSec: number
  workers: number
}

export const CHUTE_NAMES = ['bulletin', 'tripwires', 'dockets'] as const

/**
 * Keys:
 * CHUTE_URL — url ('memory://chute')
 * CHUTE_VISIBILITY_SEC — visibilitySec (30)
 * CHUTE_WINDOW_SEC — windowSec (12)
 * CHUTE_WORKERS — workers (2)
 */
export function loadChute(env: Record<string, string | undefined> = process.env): ChuteConfig {
  return {
    url: env.CHUTE_URL ?? 'memory://chute',
    visibilitySec: Number(env.CHUTE_VISIBILITY_SEC ?? 30),
    windowSec: Number(env.CHUTE_WINDOW_SEC ?? 12),
    workers: Number(env.CHUTE_WORKERS ?? 2),
  }
}

export function freezeChuteConfig(cfg: ChuteConfig): Readonly<ChuteConfig> {
  return Object.freeze({ ...cfg })
}

export function describeChuteConfig(cfg: ChuteConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeChuteConfig(base: ChuteConfig, patch: Partial<ChuteConfig>): ChuteConfig {
  return { ...base, ...patch }
}

export function pickChuteConfig<K extends keyof ChuteConfig>(cfg: ChuteConfig, keys: K[]): Pick<ChuteConfig, K> {
  const out = {} as Pick<ChuteConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
