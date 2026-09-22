import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Shipment = {
  id: string
  createdAt: number
  updatedAt: number
  orderId: string
  status: string
  carrier: string
  tracking: string
}

export type ShipmentInput = {
  orderId?: string
  status?: string
  carrier?: string
  tracking?: string
}

export const SHIPMENT_PREFIX = 'shp'

export function makeShipment(input: ShipmentInput = {}): Shipment {
  const at = now()
  return {
    id: nextId('shp'),
    createdAt: at,
    updatedAt: at,
    orderId: input.orderId ?? 'ord_1',
    status: input.status ?? 'pending',
    carrier: input.carrier ?? 'dhl',
    tracking: input.tracking ?? '',
  }
}

export function touchShipment(row: Shipment, patch: ShipmentInput = {}): Shipment {
  const next = { ...row, updatedAt: now() }
  if (patch.orderId !== undefined) next.orderId = patch.orderId
  if (patch.status !== undefined) next.status = patch.status
  if (patch.carrier !== undefined) next.carrier = patch.carrier
  if (patch.tracking !== undefined) next.tracking = patch.tracking
  return next
}

export function summarizeShipment(row: Shipment): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isShipment(value: unknown): value is Shipment {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Shipment).id === 'string'
}

export function sortShipments(rows: Shipment[]): Shipment[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
