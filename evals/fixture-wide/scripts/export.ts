import { createStore, all, type Store } from '../src/lib/store'
import { table } from '../src/lib/csv'
import { loadStorage } from '../config/storage'
import { loadLimits } from '../config/limits'
import { info } from '../src/lib/logger'

export function catalogCsv(store: Store): string {
  return table(['id', 'slug', 'title', 'published'], all(store.catalog).map(c => [c.id, c.slug, c.title, c.published]))
}

export function itemsCsv(store: Store): string {
  return table(['id', 'sku', 'name', 'price'], all(store.items).map(i => [i.id, i.sku, i.name, i.price]))
}

export function usersCsv(store: Store): string {
  return table(['id', 'email', 'role'], all(store.users).map(u => [u.id, u.email, u.role]))
}

export function ordersCsv(store: Store): string {
  return table(['id', 'userId', 'status', 'total'], all(store.orders).map(o => [o.id, o.userId, o.status, o.total]))
}

export function exportCatalog(store = createStore()) {
  const storage = loadStorage()
  const limits = loadLimits()
  const csv = catalogCsv(store)
  info('export.catalog', { bucket: storage.bucket, prefix: storage.prefix, page: limits.catalogPageSize })
  return { bucket: storage.bucket, csv }
}

export function exportItems(store = createStore()) {
  return { csv: itemsCsv(store) }
}

export function exportAll(store = createStore()) {
  return { users: usersCsv(store), orders: ordersCsv(store), items: itemsCsv(store), catalog: catalogCsv(store) }
}

export function exportUsers(store = createStore()) {
  return { csv: usersCsv(store) }
}

if (import.meta.main) exportCatalog()
