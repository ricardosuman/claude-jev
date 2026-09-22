export type DatabaseConfig = {
  url: string
  pool: number
  slowMs: number
  ssl: boolean
}

export const MIGRATIONS_TABLE = 'schema_migrations'

/**
 * Environment keys:
 * DATABASE_URL — url (default 'memory://harbor')
 * DATABASE_POOL — pool (default 5)
 * DATABASE_SLOW_MS — slowMs (default 200)
 * DATABASE_SSL — ssl (default false)
 */
export function loadDatabase(env: Record<string, string | undefined> = process.env): DatabaseConfig {
  return {
    url: env.DATABASE_URL ?? 'memory://harbor',
    pool: Number(env.DATABASE_POOL ?? 5),
    slowMs: Number(env.DATABASE_SLOW_MS ?? 200),
    ssl: env.DATABASE_SSL === '1' || env.DATABASE_SSL === 'true' ? true : env.DATABASE_SSL === '0' || env.DATABASE_SSL === 'false' ? false : false,
  }
}

export function freezeDatabaseConfig(cfg: DatabaseConfig): Readonly<DatabaseConfig> {
  return Object.freeze({ ...cfg })
}

export function describeDatabaseConfig(cfg: DatabaseConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeDatabaseConfig(base: DatabaseConfig, patch: Partial<DatabaseConfig>): DatabaseConfig {
  return { ...base, ...patch }
}

export function pickDatabaseConfig<K extends keyof DatabaseConfig>(cfg: DatabaseConfig, keys: K[]): Pick<DatabaseConfig, K> {
  const out = {} as Pick<DatabaseConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
