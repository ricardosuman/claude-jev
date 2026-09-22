export type AppConfig = {
  name: string
  env: string
  logLevel: string
  release: string
}

export const APP_ID = 'harbor-api'

/**
 * Environment keys:
 * APP_NAME — name (default 'harbor')
 * APP_ENV — env (default 'test')
 * LOG_LEVEL — logLevel (default 'info')
 * RELEASE — release (default 'dev')
 */
export function loadApp(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    name: env.APP_NAME ?? 'harbor',
    env: env.APP_ENV ?? 'test',
    logLevel: env.LOG_LEVEL ?? 'info',
    release: env.RELEASE ?? 'dev',
  }
}

export function freezeAppConfig(cfg: AppConfig): Readonly<AppConfig> {
  return Object.freeze({ ...cfg })
}

export function describeAppConfig(cfg: AppConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeAppConfig(base: AppConfig, patch: Partial<AppConfig>): AppConfig {
  return { ...base, ...patch }
}

export function pickAppConfig<K extends keyof AppConfig>(cfg: AppConfig, keys: K[]): Pick<AppConfig, K> {
  const out = {} as Pick<AppConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
