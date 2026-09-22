import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeCatalog, sortCatalogs, touchCatalog, type Catalog, type CatalogInput } from '../models/catalog'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'

export const CATALOG_SYNC_BATCH = 40

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<Catalog> {
  const { page, limit } = parsePage(query)
  return slice(sortCatalogs(all(store.catalog)), page, limit)
}

export function get(store: Store, id: string): Catalog | undefined {
  return store.catalog.get(id)
}

export function require(store: Store, id: string): Catalog {
  const row = get(store, id)
  if (!row) throw notFound('catalog')
  return row
}


export function create(store: Store, input: CatalogInput): Catalog {
  const row = makeCatalog(input)
  return put(store.catalog, row)
}

export function update(store: Store, id: string, patch: CatalogInput): Catalog {
  const row = require(store, id)
  const next = touchCatalog(row, patch)
  info('catalog.update', { id })
  return put(store.catalog, next)
}

export function remove(store: Store, id: string): void {
  if (!store.catalog.delete(id)) throw notFound('catalog')
}

export function count(store: Store): number {
  return store.catalog.size
}

export function filter(store: Store, pred: (row: Catalog) => boolean): Catalog[] {
  return all(store.catalog).filter(pred)
}
