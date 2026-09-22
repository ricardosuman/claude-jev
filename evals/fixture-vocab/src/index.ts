import { createVault } from './lib/vault'
import { dispatch, describeApp } from './app'
import { info } from './lib/logger'

export { createVault } from './lib/vault'
export { dispatch, describeApp } from './app'

export function boot(): { vault: ReturnType<typeof createVault>; app: { name: string; port: number } } {
  const vault = createVault()
  const app = describeApp()
  info('boot', app)
  return { vault, app }
}

export function handle(method: string, path: string, body?: unknown) {
  const { vault } = boot()
  return dispatch(vault, { method, path, body })
}

export function withVault<T>(fn: (vault: ReturnType<typeof createVault>) => T): T {
  return fn(createVault())
}

export function ping() {
  return handle('GET', '/health')
}

export function snapshot() {
  const { vault, app } = boot()
  return { app, principals: vault.principals.size, allotments: vault.allotments.size, berths: vault.berths.size }
}

export function describeBoot(): string {
  const { app } = boot()
  return app.name + ':' + app.port
}

export function handleGet(path: string) {
  return handle('GET', path)
}

export function pulseStatus() {
  return ping()
}
