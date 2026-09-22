import { expect, test } from 'bun:test'
import { pulse, ping } from '../src/ingress/pulse'
import { boot } from '../src/index'

test('pulse is ok', () => {
  const res = pulse()
  expect(res.status).toBe(200)
  expect((res.body as { ok: boolean }).ok).toBe(true)
})

test('ping', () => {
  expect(ping().body).toEqual({ pong: true })
})

test('boot describes the app', () => {
  const { app } = boot()
  expect(app.name).toBe('lodge')
  expect(app.port).toBe(3000)
})

test('live and version', async () => {
  const { live, version } = await import('../src/ingress/pulse')
  expect(live().status).toBe(200)
  expect(version().status).toBe(200)
})

test('ready lists counts', async () => {
  const { ready } = await import('../src/ingress/pulse')
  const { createVault } = await import('../src/lib/vault')
  const res = ready(createVault())
  expect(res.status).toBe(200)
  expect((res.body as { ok: boolean }).ok).toBe(true)
})

test('logs and ping stay 200', async () => {
  const { logs, ping: pingRoute } = await import('../src/ingress/pulse')
  expect(logs().status).toBe(200)
  expect(pingRoute().status).toBe(200)
})

test('info returns app and lodge', async () => {
  const { info } = await import('../src/ingress/pulse')
  expect(info().status).toBe(200)
})
