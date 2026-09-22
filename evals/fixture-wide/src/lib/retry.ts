export type RetryOpts = { attempts?: number; delayMs?: number; shouldRetry?: (err: unknown) => boolean }

export async function retry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const attempts = opts.attempts ?? 3
  const delayMs = opts.delayMs ?? 10
  const shouldRetry = opts.shouldRetry ?? (() => true)
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i === attempts - 1 || !shouldRetry(err)) throw err
      await sleep(delayMs * (i + 1))
    }
  }
  throw last
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function backoff(attempt: number, base = 25, cap = 1_000): number {
  return Math.min(cap, base * 2 ** attempt)
}

export function jitter(ms: number, spread = 0.2): number {
  const delta = ms * spread
  return Math.round(ms - delta + Math.random() * 2 * delta)
}

export function attemptsFor(errCount: number, max = 5): number {
  return Math.min(max, Math.max(1, errCount + 1))
}

export function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

export async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  return retry(fn, { attempts: 2, delayMs: 1 })
}
