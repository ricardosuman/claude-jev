import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeItem, sortItems, touchItem, type Item, type ItemInput } from '../models/item'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'
import { assertPresent } from '../lib/validate'

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<Item> {
  const { page, limit } = parsePage(query)
  return slice(sortItems(all(store.items)), page, limit)
}

export function get(store: Store, id: string): Item | undefined {
  return store.items.get(id)
}

export function require(store: Store, id: string): Item {
  const row = get(store, id)
  if (!row) throw notFound('item')
  return row
}


export function create(store: Store, input: ItemInput): Item {
  assertPresent(input.sku, 'sku')
  assertPresent(input.name, 'name')
  const row = makeItem(input)
  return put(store.items, row)
}

export function update(store: Store, id: string, patch: ItemInput): Item {
  const row = require(store, id)
  const next = touchItem(row, patch)
  info('item.update', { id })
  return put(store.items, next)
}

export function remove(store: Store, id: string): void {
  if (!store.items.delete(id)) throw notFound('item')
}

export function count(store: Store): number {
  return store.items.size
}

export function filter(store: Store, pred: (row: Item) => boolean): Item[] {
  return all(store.items).filter(pred)
}
