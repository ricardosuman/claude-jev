import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as webhooks from '../services/webhookService'
import type { WebhookInput } from '../models/webhook'

export function list(store: Store, query: Query = {}): Result {
  return json(webhooks.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = webhooks.get(store, id)
  if (!row) throw notFound('webhook')
  return json(row)
}

export function create(store: Store, input: WebhookInput): Result {
  return created(webhooks.create(store, input))
}

export function update(store: Store, id: string, input: WebhookInput): Result {
  return json(webhooks.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  webhooks.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: webhooks.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: webhooks.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(webhooks.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = webhooks.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(webhooks.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}

export function disable(store: Store, id: string): Result {
  const hook = webhooks.get(store, id)
  if (!hook) throw notFound('webhook')
  if (hook.event === 'disabled') throw conflict('already disabled')
  return json(webhooks.update(store, id, { event: 'disabled' }))
}

