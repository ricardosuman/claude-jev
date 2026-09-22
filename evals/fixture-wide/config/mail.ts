export type MailConfig = {
  from: string
  host: string
  port: number
  retryWindowSec: number
}

export const MAIL_BATCH = 25

/**
 * Environment keys:
 * MAIL_FROM — from (default 'ops@harbor.test')
 * MAIL_HOST — host (default 'localhost')
 * MAIL_PORT — port (default 1025)
 * MAIL_RETRY_WINDOW_SEC — retryWindowSec (default 15)
 */
export function loadMail(env: Record<string, string | undefined> = process.env): MailConfig {
  return {
    from: env.MAIL_FROM ?? 'ops@harbor.test',
    host: env.MAIL_HOST ?? 'localhost',
    port: Number(env.MAIL_PORT ?? 1025),
    retryWindowSec: Number(env.MAIL_RETRY_WINDOW_SEC ?? 15),
  }
}

export function freezeMailConfig(cfg: MailConfig): Readonly<MailConfig> {
  return Object.freeze({ ...cfg })
}

export function describeMailConfig(cfg: MailConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeMailConfig(base: MailConfig, patch: Partial<MailConfig>): MailConfig {
  return { ...base, ...patch }
}

export function pickMailConfig<K extends keyof MailConfig>(cfg: MailConfig, keys: K[]): Pick<MailConfig, K> {
  const out = {} as Pick<MailConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
