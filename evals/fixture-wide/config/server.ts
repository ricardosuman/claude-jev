export type ServerConfig = {
  host: string
  port: number
  keepAliveSec: number
  trustProxy: boolean
}

export const DEFAULT_PORT = 3000

/**
 * Environment keys:
 * HOST — host (default '127.0.0.1')
 * PORT — port (default 3000)
 * KEEP_ALIVE_SEC — keepAliveSec (default 65)
 * TRUST_PROXY — trustProxy (default false)
 */
export function loadServer(env: Record<string, string | undefined> = process.env): ServerConfig {
  return {
    host: env.HOST ?? '127.0.0.1',
    port: Number(env.PORT ?? 3000),
    keepAliveSec: Number(env.KEEP_ALIVE_SEC ?? 65),
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true' ? true : env.TRUST_PROXY === '0' || env.TRUST_PROXY === 'false' ? false : false,
  }
}

export function freezeServerConfig(cfg: ServerConfig): Readonly<ServerConfig> {
  return Object.freeze({ ...cfg })
}

export function describeServerConfig(cfg: ServerConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeServerConfig(base: ServerConfig, patch: Partial<ServerConfig>): ServerConfig {
  return { ...base, ...patch }
}

export function pickServerConfig<K extends keyof ServerConfig>(cfg: ServerConfig, keys: K[]): Pick<ServerConfig, K> {
  const out = {} as Pick<ServerConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
