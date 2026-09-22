import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as shipments from '../services/shipmentService'
import type { ShipmentInput } from '../models/shipment'

export function list(store: Store, query: Query = {}): Result {
  return json(shipments.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = shipments.get(store, id)
  if (!row) throw notFound('shipment')
  return json(row)
}

export function create(store: Store, input: ShipmentInput): Result {
  return created(shipments.create(store, input))
}

export function update(store: Store, id: string, input: ShipmentInput): Result {
  return json(shipments.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  shipments.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: shipments.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: shipments.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(shipments.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = shipments.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(shipments.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

export function createShipment(store: Store, input: Parameters<typeof shipments.create>[1]): Result {
  return created(shipments.create(store, input))
}

export function markShipped(store: Store, id: string, tracking: string): Result {
  return json(shipments.update(store, id, { status: 'shipped', tracking }))
}

