export type StorageConfig = {
  bucket: string
  region: string
  prefix: string
  windowSec: number
}

export const STORAGE_MAX_KEYS = 1000

/**
 * Environment keys:
 * STORAGE_BUCKET — bucket (default 'harbor-local')
 * STORAGE_REGION — region (default 'local')
 * STORAGE_PREFIX — prefix (default 'dev/')
 * STORAGE_SIGNED_WINDOW_SEC — windowSec (default 90)
 */
export function loadStorage(env: Record<string, string | undefined> = process.env): StorageConfig {
  return {
    bucket: env.STORAGE_BUCKET ?? 'harbor-local',
    region: env.STORAGE_REGION ?? 'local',
    prefix: env.STORAGE_PREFIX ?? 'dev/',
    windowSec: Number(env.STORAGE_SIGNED_WINDOW_SEC ?? 90),
  }
}

export function freezeStorageConfig(cfg: StorageConfig): Readonly<StorageConfig> {
  return Object.freeze({ ...cfg })
}

export function describeStorageConfig(cfg: StorageConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeStorageConfig(base: StorageConfig, patch: Partial<StorageConfig>): StorageConfig {
  return { ...base, ...patch }
}

export function pickStorageConfig<K extends keyof StorageConfig>(cfg: StorageConfig, keys: K[]): Pick<StorageConfig, K> {
  const out = {} as Pick<StorageConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
