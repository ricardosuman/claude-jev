import type { User } from '../models/user'
import type { Order } from '../models/order'
import type { Item } from '../models/item'
import type { Inventory } from '../models/inventory'
import type { Session } from '../models/session'
import type { Note } from '../models/note'
import type { Tag } from '../models/tag'
import type { Audit } from '../models/audit'
import type { Shipment } from '../models/shipment'
import type { Webhook } from '../models/webhook'
import type { Report } from '../models/report'
import type { Catalog } from '../models/catalog'

export type Store = {
  users: Map<string, User>
  orders: Map<string, Order>
  items: Map<string, Item>
  inventory: Map<string, Inventory>
  sessions: Map<string, Session>
  notes: Map<string, Note>
  tags: Map<string, Tag>
  audit: Map<string, Audit>
  shipments: Map<string, Shipment>
  webhooks: Map<string, Webhook>
  reports: Map<string, Report>
  catalog: Map<string, Catalog>
}

export function createStore(): Store {
  return {
    users: new Map(),
    orders: new Map(),
    items: new Map(),
    inventory: new Map(),
    sessions: new Map(),
    notes: new Map(),
    tags: new Map(),
    audit: new Map(),
    shipments: new Map(),
    webhooks: new Map(),
    reports: new Map(),
    catalog: new Map(),
  }
}

export function all<T>(map: Map<string, T>): T[] {
  return [...map.values()]
}

export function put<T extends { id: string }>(map: Map<string, T>, row: T): T {
  map.set(row.id, row)
  return row
}

export function drop(map: Map<string, unknown>, id: string): boolean {
  return map.delete(id)
}

export function size(store: Store): Record<string, number> {
  return {
    users: store.users.size,
    orders: store.orders.size,
    items: store.items.size,
    inventory: store.inventory.size,
    sessions: store.sessions.size,
    notes: store.notes.size,
    tags: store.tags.size,
    audit: store.audit.size,
    shipments: store.shipments.size,
    webhooks: store.webhooks.size,
    reports: store.reports.size,
    catalog: store.catalog.size,
  }
}

export function clear(store: Store): void {
  for (const map of Object.values(store)) map.clear()
}
