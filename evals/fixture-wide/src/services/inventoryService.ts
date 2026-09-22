import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeInventory, sortInventorys, touchInventory, type Inventory, type InventoryInput } from '../models/inventory'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<Inventory> {
  const { page, limit } = parsePage(query)
  return slice(sortInventorys(all(store.inventory)), page, limit)
}

export function get(store: Store, id: string): Inventory | undefined {
  return store.inventory.get(id)
}

export function require(store: Store, id: string): Inventory {
  const row = get(store, id)
  if (!row) throw notFound('inventory')
  return row
}


export function create(store: Store, input: InventoryInput): Inventory {
  const row = makeInventory(input)
  return put(store.inventory, row)
}

export function update(store: Store, id: string, patch: InventoryInput): Inventory {
  const row = require(store, id)
  const next = touchInventory(row, patch)
  info('inventory.update', { id })
  return put(store.inventory, next)
}

export function remove(store: Store, id: string): void {
  if (!store.inventory.delete(id)) throw notFound('inventory')
}

export function count(store: Store): number {
  return store.inventory.size
}

export function filter(store: Store, pred: (row: Inventory) => boolean): Inventory[] {
  return all(store.inventory).filter(pred)
}
