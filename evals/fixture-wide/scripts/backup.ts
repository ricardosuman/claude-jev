import { createStore, all, size, type Store } from '../src/lib/store'
import { table } from '../src/lib/csv'
import { info } from '../src/lib/logger'
import { iso } from '../src/lib/clock'

export function dumpUsers(store: Store): string {
  return table(['id', 'email', 'role'], all(store.users).map(u => [u.id, u.email, u.role]))
}

export function dumpOrders(store: Store): string {
  return table(['id', 'userId', 'status', 'total'], all(store.orders).map(o => [o.id, o.userId, o.status, o.total]))
}

export function dumpItems(store: Store): string {
  return table(['id', 'sku', 'name'], all(store.items).map(i => [i.id, i.sku, i.name]))
}

export function dumpNotes(store: Store): string {
  return table(['id', 'userId', 'pinned'], all(store.notes).map(n => [n.id, n.userId, n.pinned]))
}

export function dumpTags(store: Store): string {
  return table(['id', 'name', 'color'], all(store.tags).map(t => [t.id, t.name, t.color]))
}

export function backup(store = createStore()) {
  const payload = {
    at: iso(),
    users: dumpUsers(store),
    orders: dumpOrders(store),
    items: dumpItems(store),
    notes: dumpNotes(store),
    tags: dumpTags(store),
  }
  info('backup', size(store))
  return payload
}

export function empty(): boolean {
  return backup().users.split('\n').length <= 1
}

export function stamp(): string {
  return 'backup-' + iso().replaceAll(':', '')
}

if (import.meta.main) backup()
