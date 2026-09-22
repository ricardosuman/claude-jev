import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Order = {
  id: string
  createdAt: number
  updatedAt: number
  userId: string
  status: string
  total: number
}

export type OrderInput = {
  userId?: string
  status?: string
  total?: number
}

export const ORDER_PREFIX = 'ord'

export function makeOrder(input: OrderInput = {}): Order {
  const at = now()
  return {
    id: nextId('ord'),
    createdAt: at,
    updatedAt: at,
    userId: input.userId ?? 'usr_1',
    status: input.status ?? 'open',
    total: input.total ?? 0,
  }
}

export function touchOrder(row: Order, patch: OrderInput = {}): Order {
  const next = { ...row, updatedAt: now() }
  if (patch.userId !== undefined) next.userId = patch.userId
  if (patch.status !== undefined) next.status = patch.status
  if (patch.total !== undefined) next.total = patch.total
  return next
}

export function summarizeOrder(row: Order): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isOrder(value: unknown): value is Order {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Order).id === 'string'
}

export function sortOrders(rows: Order[]): Order[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
