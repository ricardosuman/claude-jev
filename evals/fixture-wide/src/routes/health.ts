import { json, type Result } from '../lib/http'
import { size, type Store } from '../lib/store'
import { iso, now } from '../lib/clock'
import { recent } from '../lib/logger'
import { loadApp } from '../../config/app'
import { loadServer } from '../../config/server'

export function health(): Result {
  const app = loadApp()
  return json({ ok: true, name: app.name, env: app.env, at: iso() })
}

export function ready(store: Store): Result {
  return json({ ok: true, counts: size(store) })
}

export function live(): Result {
  return json({ ok: true, uptimeHint: now() })
}

export function version(): Result {
  const server = loadServer()
  return json({ host: server.host, port: server.port })
}

export function logs(): Result {
  return json({ events: recent(20) })
}

export function ping(): Result {
  return json({ pong: true })
}

export function info(): Result {
  return json({ app: loadApp(), server: loadServer() })
}

export function counts(store: Store): Result {
  const c = size(store)
  return json({ total: Object.values(c).reduce((a, b) => a + b, 0), c })
}

export function recentErrors(): Result {
  return json({ events: recent(50).filter(e => e.level === 'error' || e.level === 'warn') })
}
