export type BulletinConfig = {
  from: string
  host: string
  port: number
  requeueWindowSec: number
}

export const BULLETIN_BATCH = 25

/**
 * Keys:
 * BULLETIN_FROM — from ('ops@lodge.test')
 * BULLETIN_HOST — host ('localhost')
 * BULLETIN_PORT — port (1025)
 * BULLETIN_REQUEUE_WINDOW_SEC — requeueWindowSec (15)
 */
export function loadBulletin(env: Record<string, string | undefined> = process.env): BulletinConfig {
  return {
    from: env.BULLETIN_FROM ?? 'ops@lodge.test',
    host: env.BULLETIN_HOST ?? 'localhost',
    port: Number(env.BULLETIN_PORT ?? 1025),
    requeueWindowSec: Number(env.BULLETIN_REQUEUE_WINDOW_SEC ?? 15),
  }
}

export function freezeBulletinConfig(cfg: BulletinConfig): Readonly<BulletinConfig> {
  return Object.freeze({ ...cfg })
}

export function describeBulletinConfig(cfg: BulletinConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeBulletinConfig(base: BulletinConfig, patch: Partial<BulletinConfig>): BulletinConfig {
  return { ...base, ...patch }
}

export function pickBulletinConfig<K extends keyof BulletinConfig>(cfg: BulletinConfig, keys: K[]): Pick<BulletinConfig, K> {
  const out = {} as Pick<BulletinConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
