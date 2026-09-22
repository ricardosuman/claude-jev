import { expect, test } from 'bun:test'
import { health, ping } from '../src/routes/health'
import { boot } from '../src/index'

test('health returns ok', () => {
  const res = health()
  expect(res.status).toBe(200)
  expect((res.body as { ok: boolean }).ok).toBe(true)
})

test('ping', () => {
  expect(ping().body).toEqual({ pong: true })
})

test('boot describes the app', () => {
  const { app } = boot()
  expect(app.name).toBe('harbor')
  expect(app.port).toBe(3000)
})

test('live and version', async () => {
  const { live, version } = await import('../src/routes/health')
  expect(live().status).toBe(200)
  expect(version().status).toBe(200)
})

test('ready lists counts', async () => {
  const { ready } = await import('../src/routes/health')
  const { createStore } = await import('../src/lib/store')
  const res = ready(createStore())
  expect(res.status).toBe(200)
  expect((res.body as { ok: boolean }).ok).toBe(true)
})

test('logs and ping stay 200', async () => {
  const { logs, ping: pingRoute } = await import('../src/routes/health')
  expect(logs().status).toBe(200)
  expect(pingRoute().status).toBe(200)
})

test('info returns app and server', async () => {
  const { info } = await import('../src/routes/health')
  expect(info().status).toBe(200)
})
