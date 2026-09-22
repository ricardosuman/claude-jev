import { badRequest } from './errors'

export function assertPresent(value: string | undefined, field: string): string {
  if (value === undefined || value.trim() === '') throw badRequest(field + ' is required')
  return value
}

export function assertAddr(value: string): string {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) throw badRequest('invalid addr')
  return value
}

export function assertPositive(n: number, field: string): number {
  if (!Number.isFinite(n) || n <= 0) throw badRequest(field + ' must be positive')
  return n
}

export function assertNonNegative(n: number, field: string): number {
  if (!Number.isFinite(n) || n < 0) throw badRequest(field + ' must be >= 0')
  return n
}

export function assertOneOf<T extends string>(value: string, allowed: readonly T[], field: string): T {
  if (!(allowed as readonly string[]).includes(value)) throw badRequest('invalid ' + field)
  return value as T
}

export function assertLen(value: string, min: number, max: number, field: string): string {
  if (value.length < min || value.length > max) throw badRequest(field + ' length')
  return value
}

export function assertInt(n: number, field: string): number {
  if (!Number.isInteger(n)) throw badRequest(field + ' must be an integer')
  return n
}

export function assertUrl(value: string): string {
  if (!/^https?:\/\//.test(value)) throw badRequest('invalid url')
  return value
}

export function clampStr(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max)
}
