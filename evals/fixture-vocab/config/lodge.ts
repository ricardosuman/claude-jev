export type LodgeConfig = {
  host: string
  port: number
  idleSec: number
  trustProxy: boolean
}

export const FALLBACK_PORT = 3000

/**
 * Keys:
 * HOST — host ('127.0.0.1')
 * PORT — port (3000)
 * IDLE_SEC — idleSec (65)
 * TRUST_PROXY — trustProxy (false)
 */
export function loadLodge(env: Record<string, string | undefined> = process.env): LodgeConfig {
  return {
    host: env.HOST ?? '127.0.0.1',
    port: Number(env.PORT ?? 3000),
    idleSec: Number(env.IDLE_SEC ?? 65),
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true' ? true : env.TRUST_PROXY === '0' || env.TRUST_PROXY === 'false' ? false : false,
  }
}

export function freezeLodgeConfig(cfg: LodgeConfig): Readonly<LodgeConfig> {
  return Object.freeze({ ...cfg })
}

export function describeLodgeConfig(cfg: LodgeConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeLodgeConfig(base: LodgeConfig, patch: Partial<LodgeConfig>): LodgeConfig {
  return { ...base, ...patch }
}

export function pickLodgeConfig<K extends keyof LodgeConfig>(cfg: LodgeConfig, keys: K[]): Pick<LodgeConfig, K> {
  const out = {} as Pick<LodgeConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
