import { loadServer } from '../config/server'
import { loadApp } from '../config/app'
import { loadDatabase } from '../config/database'
import { health, ping } from '../src/routes/health'

export type Check = { ok: boolean; name: string; detail: string }

export function checkApp(): Check {
  const app = loadApp()
  return { ok: !!app.name, name: 'app', detail: app.env }
}

export function checkServer(): Check {
  const server = loadServer()
  return { ok: server.port > 0, name: 'server', detail: server.host + ':' + server.port }
}

export function checkDb(): Check {
  const db = loadDatabase()
  return { ok: db.url.length > 0, name: 'database', detail: db.url }
}

export function checkRoutes(): Check {
  const res = health()
  const pong = ping()
  return { ok: res.status === 200 && pong.status === 200, name: 'routes', detail: String(res.status) }
}

export function failed(parts: Check[]): Check[] {
  return parts.filter(p => !p.ok)
}

export function format(parts: Check[]): string {
  return parts.map(p => (p.ok ? 'ok' : 'fail') + ':' + p.name + ':' + p.detail).join('\n')
}

export function check() {
  const parts = [checkApp(), checkServer(), checkDb(), checkRoutes()]
  return { ok: parts.every(p => p.ok), app: loadApp().name, port: loadServer().port, parts, failed: failed(parts) }
}

if (import.meta.main) {
  const r = check()
  if (!r.ok) process.exit(1)
}
