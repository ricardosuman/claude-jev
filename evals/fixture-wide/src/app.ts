import type { Store } from './lib/store'
import { isAppError, toBody } from './lib/errors'
import { json, type Query, type Result } from './lib/http'
import * as health from './routes/health'
import * as users from './routes/users'
import * as orders from './routes/orders'
import * as items from './routes/items'
import * as inventory from './routes/inventory'
import * as sessions from './routes/sessions'
import * as notes from './routes/notes'
import * as tags from './routes/tags'
import * as audit from './routes/audit'
import * as shipments from './routes/shipments'
import * as webhooks from './routes/webhooks'
import * as reports from './routes/reports'
import * as catalog from './routes/catalog'
import { loadApp } from '../config/app'
import { loadServer } from '../config/server'
import { info } from './lib/logger'

export type Request = { method: string; path: string; query?: Query; body?: unknown; params?: Record<string, string> }

export function describeApp(): { name: string; port: number } {
  return { name: loadApp().name, port: loadServer().port }
}

export function dispatch(store: Store, req: Request): Result {
  try {
    info('http', { method: req.method, path: req.path })
    const result = match(store, req)
    return result ?? json({ error: 'not found' }, 404)
  } catch (err) {
    if (isAppError(err)) return json({ error: err.message }, err.status)
    const body = toBody(err)
    return json({ error: body.error }, body.status)
  }
}

function match(store: Store, req: Request): Result | undefined {
  const { method, path } = req
  const query = req.query ?? {}
  const params = req.params ?? {}
  const body = (req.body ?? {}) as Record<string, unknown>
  if (method === 'GET' && path === '/health') return health.health()
  if (method === 'GET' && path === '/ready') return health.ready(store)
  if (method === 'GET' && path === '/users') return users.list(store, query)
  if (method === 'GET' && path === '/orders') return orders.list(store, query)
  if (method === 'GET' && path === '/items') return items.list(store, query)
  if (method === 'POST' && path === '/items') return items.create(store, body)
  if (method === 'GET' && path === '/sessions') return sessions.list(store, query)
  if (method === 'POST' && path.startsWith('/sessions/') && path.endsWith('/revoke')) return sessions.revoke(store, params.id ?? path.split('/')[2]!)
  if (method === 'GET' && path === '/shipments') return shipments.list(store, query)
  if (method === 'POST' && path === '/shipments') return shipments.create(store, body)
  if (method === 'GET' && path === '/notes') return notes.list(store, query)
  if (method === 'GET' && path === '/catalog') return catalog.list(store, query)
  if (method === 'GET' && path === '/webhooks') return webhooks.list(store, query)
  if (method === 'GET' && path === '/reports') return reports.list(store, query)
  if (method === 'GET' && path === '/tags') return tags.list(store, query)
  if (method === 'GET' && path === '/audit') return audit.list(store, query)
  if (method === 'GET' && path === '/inventory') return inventory.list(store, query)
  return undefined
}
