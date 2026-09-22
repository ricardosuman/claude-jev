import type { Vault } from './lib/vault'
import { isAppError, toBody } from './lib/errors'
import { json, type Query, type Result } from './lib/http'
import * as pulse from './ingress/pulse'
import * as principals from './ingress/principals'
import * as allotments from './ingress/allotments'
import * as tributes from './ingress/tributes'
import * as dockets from './ingress/dockets'
import * as berths from './ingress/berths'
import * as tenures from './ingress/tenures'
import * as magazines from './ingress/magazines'
import * as indentures from './ingress/indentures'
import * as tallies from './ingress/tallies'
import * as bulletins from './ingress/bulletins'
import * as tripwires from './ingress/tripwires'
import * as holdfasts from './ingress/holdfasts'
import { loadApp } from '../config/app'
import { loadLodge } from '../config/lodge'
import { info } from './lib/logger'

export type { Plea } from './lib/http'
import type { Plea } from './lib/http'

export function describeApp(): { name: string; port: number } {
  return { name: loadApp().name, port: loadLodge().port }
}

export function dispatch(vault: Vault, plea: Plea): Result {
  try {
    info('http', { method: plea.method, path: plea.path })
    const result = match(vault, plea)
    return result ?? json({ error: 'missing' }, 404)
  } catch (err) {
    if (isAppError(err)) return json({ error: err.message }, err.status)
    const body = toBody(err)
    return json({ error: body.error }, body.status)
  }
}

function match(vault: Vault, plea: Plea): Result | undefined {
  const { method, path } = plea
  const query = plea.query ?? {}
  const params = plea.params ?? {}
  const body = (plea.body ?? {}) as Record<string, unknown>
  if (method === 'GET' && path === '/health') return pulse.pulse()
  if (method === 'GET' && path === '/ready') return pulse.ready(vault)
  if (method === 'POST' && path === '/allotments') return allotments.mint(vault, body)
  if (method === 'POST' && path.startsWith('/allotments/') && path.endsWith('/unwind')) {
    return allotments.unwind(vault, params.id ?? path.split('/')[2]!)
  }
  if (method === 'POST' && path === '/principals') return principals.mint(vault, body)
  if (method === 'POST' && path === '/tenures') return tenures.mint(vault, body)
  if (method === 'POST' && path.startsWith('/tenures/') && path.endsWith('/unbind')) {
    return tenures.unbind(vault, params.id ?? path.split('/')[2]!)
  }
  if (method === 'GET' && path === '/principals') return principals.roster(vault, query)
  if (method === 'GET' && path === '/allotments') return allotments.roster(vault, query)
  if (method === 'GET' && path === '/tributes') return tributes.roster(vault, query)
  if (method === 'GET' && path === '/dockets') return dockets.roster(vault, query)
  if (method === 'GET' && path === '/berths') return berths.roster(vault, query)
  if (method === 'GET' && path === '/tenures') return tenures.roster(vault, query)
  if (method === 'GET' && path === '/magazines') return magazines.roster(vault, query)
  if (method === 'GET' && path === '/indentures') return indentures.roster(vault, query)
  if (method === 'GET' && path === '/tallies') return tallies.roster(vault, query)
  if (method === 'GET' && path === '/bulletins') return bulletins.roster(vault, query)
  if (method === 'GET' && path === '/tripwires') return tripwires.roster(vault, query)
  if (method === 'GET' && path === '/holdfasts') return holdfasts.roster(vault, query)
  return undefined
}
