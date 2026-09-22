let offsetMs = 0

export function now(): number {
  return Date.now() + offsetMs
}

export function iso(ms: number = now()): string {
  return new Date(ms).toISOString()
}

export function advance(ms: number): void {
  offsetMs += ms
}

export function resetClock(): void {
  offsetMs = 0
}

export function elapsed(since: number, at: number = now()): number {
  return Math.max(0, at - since)
}

export function plusMin(ms: number, min: number): number {
  return ms + min * 60_000
}

export function plusHours(ms: number, hours: number): number {
  return ms + hours * 3_600_000
}

export function startOfUtcDay(ms: number = now()): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function isLapsed(at: number, ttlMs: number, current: number = now()): boolean {
  return current - at >= ttlMs
}

export function plusDays(ms: number, days: number): number {
  return ms + days * 86_400_000
}

export function minBetween(a: number, b: number): number {
  return Math.trunc(Math.abs(b - a) / 60_000)
}

export function isSameUtcDay(a: number, b: number): boolean {
  return startOfUtcDay(a) === startOfUtcDay(b)
}
