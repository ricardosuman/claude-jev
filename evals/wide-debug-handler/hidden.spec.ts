import { expect, test } from 'bun:test'
import { AppError } from './lib/errors'
import { createStore } from './lib/store'
import { revoke } from './routes/sessions'
import { create, get } from './services/sessionService'

test('revoke marks an active session', () => {
  const store = createStore()
  const session = create(store, { userId: 'usr_1' })
  const res = revoke(store, session.id)
  expect(res.status).toBe(200)
  expect(get(store, session.id)!.revokedAt).not.toBeNull()
})

test('revoke of a missing session is 404', () => {
  const store = createStore()
  expect(() => revoke(store, 'ses_nope')).toThrow(AppError)
  try {
    revoke(store, 'ses_nope')
  } catch (err) {
    expect((err as AppError).status).toBe(404)
  }
})

test('revoke of an already revoked session is 409', () => {
  const store = createStore()
  const session = create(store, { userId: 'usr_1' })
  revoke(store, session.id)
  try {
    revoke(store, session.id)
    throw new Error('expected conflict')
  } catch (err) {
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).status).toBe(409)
  }
})
