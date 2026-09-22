export type QueueConfig = {
  url: string
  visibilitySec: number
  windowSec: number
  workers: number
}

export const QUEUE_NAMES = ['mail', 'webhooks', 'reports'] as const

/**
 * Environment keys:
 * QUEUE_URL — url (default 'memory://queue')
 * QUEUE_VISIBILITY_SEC — visibilitySec (default 30)
 * QUEUE_WINDOW_SEC — windowSec (default 12)
 * QUEUE_WORKERS — workers (default 2)
 */
export function loadQueue(env: Record<string, string | undefined> = process.env): QueueConfig {
  return {
    url: env.QUEUE_URL ?? 'memory://queue',
    visibilitySec: Number(env.QUEUE_VISIBILITY_SEC ?? 30),
    windowSec: Number(env.QUEUE_WINDOW_SEC ?? 12),
    workers: Number(env.QUEUE_WORKERS ?? 2),
  }
}

export function freezeQueueConfig(cfg: QueueConfig): Readonly<QueueConfig> {
  return Object.freeze({ ...cfg })
}

export function describeQueueConfig(cfg: QueueConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeQueueConfig(base: QueueConfig, patch: Partial<QueueConfig>): QueueConfig {
  return { ...base, ...patch }
}

export function pickQueueConfig<K extends keyof QueueConfig>(cfg: QueueConfig, keys: K[]): Pick<QueueConfig, K> {
  const out = {} as Pick<QueueConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
