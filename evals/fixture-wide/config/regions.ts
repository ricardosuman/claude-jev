export type RegionsConfig = {
  home: string
  failover: string
  windowTz: string
  strict: boolean
}

export const KNOWN_REGIONS = ['us-east', 'us-west', 'eu-west'] as const

/**
 * Environment keys:
 * REGION_HOME — home (default 'us-east')
 * REGION_FAILOVER — failover (default 'us-west')
 * REGION_WINDOW_TZ — windowTz (default 'UTC')
 * REGION_STRICT — strict (default false)
 */
export function loadRegions(env: Record<string, string | undefined> = process.env): RegionsConfig {
  return {
    home: env.REGION_HOME ?? 'us-east',
    failover: env.REGION_FAILOVER ?? 'us-west',
    windowTz: env.REGION_WINDOW_TZ ?? 'UTC',
    strict: env.REGION_STRICT === '1' || env.REGION_STRICT === 'true' ? true : env.REGION_STRICT === '0' || env.REGION_STRICT === 'false' ? false : false,
  }
}

export function freezeRegionsConfig(cfg: RegionsConfig): Readonly<RegionsConfig> {
  return Object.freeze({ ...cfg })
}

export function describeRegionsConfig(cfg: RegionsConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeRegionsConfig(base: RegionsConfig, patch: Partial<RegionsConfig>): RegionsConfig {
  return { ...base, ...patch }
}

export function pickRegionsConfig<K extends keyof RegionsConfig>(cfg: RegionsConfig, keys: K[]): Pick<RegionsConfig, K> {
  const out = {} as Pick<RegionsConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
