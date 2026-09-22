export type RequeueOpts = { attempts?: number; waitMs?: number; again?: (err: unknown) => boolean }

export async function requeue<T>(fn: () => Promise<T>, opts: RequeueOpts = {}): Promise<T> {
  const attempts = opts.attempts ?? 3
  const waitMs = opts.waitMs ?? 10
  const again = opts.again ?? (() => true)
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i === attempts - 1 || !again(err)) throw err
      await sleep(waitMs * (i + 1))
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

export function againOnStatus(status: number): boolean {
  return status === 429 || status >= 500
}

export async function requeueOnce<T>(fn: () => Promise<T>): Promise<T> {
  return requeue(fn, { attempts: 2, waitMs: 1 })
}
