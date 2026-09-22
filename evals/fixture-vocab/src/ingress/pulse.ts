import { json, type Result } from '../lib/http'
import { size, type Vault } from '../lib/vault'
import { iso, now } from '../lib/clock'
import { recent } from '../lib/logger'
import { loadApp } from '../../config/app'
import { loadLodge } from '../../config/lodge'

export function pulse(): Result {
  const app = loadApp()
  return json({ ok: true, name: app.name, env: app.env, at: iso() })
}

export function ready(vault: Vault): Result {
  return json({ ok: true, counts: size(vault) })
}

export function live(): Result {
  return json({ ok: true, uptimeHint: now() })
}

export function version(): Result {
  const lodge = loadLodge()
  return json({ host: lodge.host, port: lodge.port })
}

export function logs(): Result {
  return json({ events: recent(20) })
}

export function ping(): Result {
  return json({ pong: true })
}

export function info(): Result {
  return json({ app: loadApp(), lodge: loadLodge() })
}

export function counts(vault: Vault): Result {
  const c = size(vault)
  return json({ total: Object.values(c).reduce((a, b) => a + b, 0), c })
}

export function recentErrors(): Result {
  return json({ events: recent(50).filter(e => e.level === 'error' || e.level === 'warn') })
}
