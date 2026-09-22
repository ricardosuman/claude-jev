import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Inventory = {
  id: string
  createdAt: number
  updatedAt: number
  itemId: string
  location: string
  qty: number
}

export type InventoryInput = {
  itemId?: string
  location?: string
  qty?: number
}

export const INVENTORY_PREFIX = 'inv'

export function makeInventory(input: InventoryInput = {}): Inventory {
  const at = now()
  return {
    id: nextId('inv'),
    createdAt: at,
    updatedAt: at,
    itemId: input.itemId ?? 'itm_1',
    location: input.location ?? 'A1',
    qty: input.qty ?? 0,
  }
}

export function touchInventory(row: Inventory, patch: InventoryInput = {}): Inventory {
  const next = { ...row, updatedAt: now() }
  if (patch.itemId !== undefined) next.itemId = patch.itemId
  if (patch.location !== undefined) next.location = patch.location
  if (patch.qty !== undefined) next.qty = patch.qty
  return next
}

export function summarizeInventory(row: Inventory): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isInventory(value: unknown): value is Inventory {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Inventory).id === 'string'
}

export function sortInventorys(rows: Inventory[]): Inventory[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
