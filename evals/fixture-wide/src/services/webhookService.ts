import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeWebhook, sortWebhooks, touchWebhook, type Webhook, type WebhookInput } from '../models/webhook'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<Webhook> {
  const { page, limit } = parsePage(query)
  return slice(sortWebhooks(all(store.webhooks)), page, limit)
}

export function get(store: Store, id: string): Webhook | undefined {
  return store.webhooks.get(id)
}

export function require(store: Store, id: string): Webhook {
  const row = get(store, id)
  if (!row) throw notFound('webhook')
  return row
}


export function create(store: Store, input: WebhookInput): Webhook {
  const row = makeWebhook(input)
  return put(store.webhooks, row)
}

export function update(store: Store, id: string, patch: WebhookInput): Webhook {
  const row = require(store, id)
  const next = touchWebhook(row, patch)
  info('webhook.update', { id })
  return put(store.webhooks, next)
}

export function remove(store: Store, id: string): void {
  if (!store.webhooks.delete(id)) throw notFound('webhook')
}

export function count(store: Store): number {
  return store.webhooks.size
}

export function filter(store: Store, pred: (row: Webhook) => boolean): Webhook[] {
  return all(store.webhooks).filter(pred)
}
