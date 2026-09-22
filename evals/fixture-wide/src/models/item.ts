import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Item = {
  id: string
  createdAt: number
  updatedAt: number
  sku: string
  name: string
  price: string
}

export type ItemInput = {
  sku?: string
  name?: string
  price?: string
}

export const ITEM_PREFIX = 'itm'

export function makeItem(input: ItemInput = {}): Item {
  const at = now()
  return {
    id: nextId('itm'),
    createdAt: at,
    updatedAt: at,
    sku: input.sku ?? 'SKU0001',
    name: input.name ?? 'widget',
    price: input.price ?? '9.00',
  }
}

export function touchItem(row: Item, patch: ItemInput = {}): Item {
  const next = { ...row, updatedAt: now() }
  if (patch.sku !== undefined) next.sku = patch.sku
  if (patch.name !== undefined) next.name = patch.name
  if (patch.price !== undefined) next.price = patch.price
  return next
}

export function summarizeItem(row: Item): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isItem(value: unknown): value is Item {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Item).id === 'string'
}

export function sortItems(rows: Item[]): Item[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
