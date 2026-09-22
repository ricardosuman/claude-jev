import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeShipment, sortShipments, touchShipment, type Shipment, type ShipmentInput } from '../models/shipment'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'
import { token } from '../lib/ids'
import { assertPresent } from '../lib/validate'

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<Shipment> {
  const { page, limit } = parsePage(query)
  return slice(sortShipments(all(store.shipments)), page, limit)
}

export function get(store: Store, id: string): Shipment | undefined {
  return store.shipments.get(id)
}

export function require(store: Store, id: string): Shipment {
  const row = get(store, id)
  if (!row) throw notFound('shipment')
  return row
}


export function create(store: Store, input: ShipmentInput): Shipment {
  assertPresent(input.orderId, 'orderId')
  const tracking = input.tracking && input.tracking.length > 0 ? input.tracking : 'TRK-' + token(10)
  const row = makeShipment({ ...input, status: input.status ?? 'pending', tracking })
  return put(store.shipments, row)
}

export function update(store: Store, id: string, patch: ShipmentInput): Shipment {
  const row = require(store, id)
  const next = touchShipment(row, patch)
  info('shipment.update', { id })
  return put(store.shipments, next)
}

export function remove(store: Store, id: string): void {
  if (!store.shipments.delete(id)) throw notFound('shipment')
}

export function count(store: Store): number {
  return store.shipments.size
}

export function filter(store: Store, pred: (row: Shipment) => boolean): Shipment[] {
  return all(store.shipments).filter(pred)
}
