import { createStore } from './lib/store'
import { dispatch, describeApp } from './app'
import { info } from './lib/logger'

export { createStore } from './lib/store'
export { dispatch, describeApp } from './app'

export function boot(): { store: ReturnType<typeof createStore>; app: { name: string; port: number } } {
  const store = createStore()
  const app = describeApp()
  info('boot', app)
  return { store, app }
}

export function handle(method: string, path: string, body?: unknown) {
  const { store } = boot()
  return dispatch(store, { method, path, body })
}

export function withStore<T>(fn: (store: ReturnType<typeof createStore>) => T): T {
  return fn(createStore())
}

export function ping() {
  return handle('GET', '/health')
}

export function snapshot() {
  const { store, app } = boot()
  return { app, users: store.users.size, orders: store.orders.size, items: store.items.size }
}

export function describeBoot(): string {
  const { app } = boot()
  return app.name + ':' + app.port
}

export function handleGet(path: string) {
  return handle('GET', path)
}

export function healthStatus() {
  return ping()
}
