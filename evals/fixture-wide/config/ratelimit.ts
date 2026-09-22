export type RateLimitConfig = {
  windowSec: number
  burst: number
  loginWindowSec: number
  loginBurst: number
}

export const RATE_LIMIT_HEADER = 'x-ratelimit-remaining'

/**
 * Environment keys:
 * RATE_WINDOW_SEC — windowSec (default 60)
 * RATE_BURST — burst (default 40)
 * LOGIN_WINDOW_SEC — loginWindowSec (default 300)
 * LOGIN_BURST — loginBurst (default 8)
 */
export function loadRateLimit(env: Record<string, string | undefined> = process.env): RateLimitConfig {
  return {
    windowSec: Number(env.RATE_WINDOW_SEC ?? 60),
    burst: Number(env.RATE_BURST ?? 40),
    loginWindowSec: Number(env.LOGIN_WINDOW_SEC ?? 300),
    loginBurst: Number(env.LOGIN_BURST ?? 8),
  }
}

export function freezeRateLimitConfig(cfg: RateLimitConfig): Readonly<RateLimitConfig> {
  return Object.freeze({ ...cfg })
}

export function describeRateLimitConfig(cfg: RateLimitConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeRateLimitConfig(base: RateLimitConfig, patch: Partial<RateLimitConfig>): RateLimitConfig {
  return { ...base, ...patch }
}

export function pickRateLimitConfig<K extends keyof RateLimitConfig>(cfg: RateLimitConfig, keys: K[]): Pick<RateLimitConfig, K> {
  const out = {} as Pick<RateLimitConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
