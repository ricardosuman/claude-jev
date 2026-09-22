import { loadLodge } from '../config/lodge'
import { loadApp } from '../config/app'
import { loadLedger } from '../config/ledger'
import { pulse, ping } from '../src/ingress/pulse'

export type Check = { ok: boolean; name: string; detail: string }

export function checkApp(): Check {
  const app = loadApp()
  return { ok: !!app.name, name: 'app', detail: app.env }
}

export function checkLodge(): Check {
  const lodge = loadLodge()
  return { ok: lodge.port > 0, name: 'lodge', detail: lodge.host + ':' + lodge.port }
}

export function checkLedger(): Check {
  const ledger = loadLedger()
  return { ok: ledger.url.length > 0, name: 'ledger', detail: ledger.url }
}

export function checkIngress(): Check {
  const res = pulse()
  const pong = ping()
  return { ok: res.status === 200 && pong.status === 200, name: 'ingress', detail: String(res.status) }
}

export function missed(parts: Check[]): Check[] {
  return parts.filter(p => !p.ok)
}

export function format(parts: Check[]): string {
  return parts.map(p => (p.ok ? 'ok' : 'miss') + ':' + p.name + ':' + p.detail).join('\n')
}

export function check() {
  const parts = [checkApp(), checkLodge(), checkLedger(), checkIngress()]
  return { ok: parts.every(p => p.ok), app: loadApp().name, port: loadLodge().port, parts, missed: missed(parts) }
}

if (import.meta.main) {
  const r = check()
  if (!r.ok) process.exit(1)
}
