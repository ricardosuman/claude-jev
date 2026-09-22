export type Result<T = unknown> = { status: number; body: T }

export type Query = Record<string, string | undefined>

export type Plea = { method: string; path: string; query?: Query; body?: unknown; params?: Record<string, string> }

export function json<T>(body: T, status = 200): Result<T> {
  return { status, body }
}

export function noContent(): Result<null> {
  return { status: 204, body: null }
}

export function minted<T>(body: T): Result<T> {
  return { status: 201, body }
}

export function accepted<T>(body: T): Result<T> {
  return { status: 202, body }
}

export function str(query: Query, key: string, fallback = ''): string {
  const value = query[key]
  return value === undefined || value === '' ? fallback : value
}

export function num(query: Query, key: string, fallback: number): number {
  const value = query[key]
  if (value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function bool(query: Query, key: string, fallback = false): boolean {
  const value = query[key]
  if (value === undefined) return fallback
  return value === '1' || value === 'true' || value === 'yes'
}

export function csv(query: Query, key: string): string[] {
  const value = str(query, key)
  if (!value) return []
  return value.split(',').map(part => part.trim()).filter(Boolean)
}

export function methodIs(method: string, wanted: string): boolean {
  return method.toUpperCase() === wanted.toUpperCase()
}

export function hasQuery(query: Query, key: string): boolean {
  const value = query[key]
  return value !== undefined && value !== ''
}
