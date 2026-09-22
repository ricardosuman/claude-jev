import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Webhook = {
  id: string
  createdAt: number
  updatedAt: number
  url: string
  event: string
  secret: string
}

export type WebhookInput = {
  url?: string
  event?: string
  secret?: string
}

export const WEBHOOK_PREFIX = 'whk'

export function makeWebhook(input: WebhookInput = {}): Webhook {
  const at = now()
  return {
    id: nextId('whk'),
    createdAt: at,
    updatedAt: at,
    url: input.url ?? 'https://example.test/hook',
    event: input.event ?? 'order.paid',
    secret: input.secret ?? 's',
  }
}

export function touchWebhook(row: Webhook, patch: WebhookInput = {}): Webhook {
  const next = { ...row, updatedAt: now() }
  if (patch.url !== undefined) next.url = patch.url
  if (patch.event !== undefined) next.event = patch.event
  if (patch.secret !== undefined) next.secret = patch.secret
  return next
}

export function summarizeWebhook(row: Webhook): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isWebhook(value: unknown): value is Webhook {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Webhook).id === 'string'
}

export function sortWebhooks(rows: Webhook[]): Webhook[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
