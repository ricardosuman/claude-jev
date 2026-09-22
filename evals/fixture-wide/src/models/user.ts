import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type User = {
  id: string
  createdAt: number
  updatedAt: number
  email: string
  name: string
  role: string
}

export type UserInput = {
  email?: string
  name?: string
  role?: string
}

export const USER_PREFIX = 'usr'

export function makeUser(input: UserInput = {}): User {
  const at = now()
  return {
    id: nextId('usr'),
    createdAt: at,
    updatedAt: at,
    email: input.email ?? 'ada@harbor.test',
    name: input.name ?? 'Ada',
    role: input.role ?? 'member',
  }
}

export function touchUser(row: User, patch: UserInput = {}): User {
  const next = { ...row, updatedAt: now() }
  if (patch.email !== undefined) next.email = patch.email
  if (patch.name !== undefined) next.name = patch.name
  if (patch.role !== undefined) next.role = patch.role
  return next
}

export function summarizeUser(row: User): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isUser(value: unknown): value is User {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as User).id === 'string'
}

export function sortUsers(rows: User[]): User[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
