export type CacheConfig = {
  url: string
  ttlSec: number
  prefix: string
  windowSec: number
}

export const CACHE_NULL_TTL_SEC = 5

/**
 * Environment keys:
 * CACHE_URL — url (default 'memory://cache')
 * CACHE_TTL_SEC — ttlSec (default 60)
 * CACHE_PREFIX — prefix (default 'hbr')
 * CACHE_WINDOW_SEC — windowSec (default 15)
 */
export function loadCache(env: Record<string, string | undefined> = process.env): CacheConfig {
  return {
    url: env.CACHE_URL ?? 'memory://cache',
    ttlSec: Number(env.CACHE_TTL_SEC ?? 60),
    prefix: env.CACHE_PREFIX ?? 'hbr',
    windowSec: Number(env.CACHE_WINDOW_SEC ?? 15),
  }
}

export function freezeCacheConfig(cfg: CacheConfig): Readonly<CacheConfig> {
  return Object.freeze({ ...cfg })
}

export function describeCacheConfig(cfg: CacheConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeCacheConfig(base: CacheConfig, patch: Partial<CacheConfig>): CacheConfig {
  return { ...base, ...patch }
}

export function pickCacheConfig<K extends keyof CacheConfig>(cfg: CacheConfig, keys: K[]): Pick<CacheConfig, K> {
  const out = {} as Pick<CacheConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
