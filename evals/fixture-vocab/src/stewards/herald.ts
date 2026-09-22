import type { Vault } from '../lib/vault'
import { all } from '../lib/vault'
import { info, warn } from '../lib/logger'
import { mask } from '../lib/hash'
import type { Principal } from '../forms/principal'

export type Notice = { to: string; subject: string; body: string; at: number }

const outbox: Notice[] = []

export function enqueue(to: string, subject: string, body: string): Notice {
  const notice = { to, subject, body, at: Date.now() }
  outbox.push(notice)
  info('herald.enqueue', { to: mask(to, 6), subject })
  return notice
}

export function pending(): Notice[] {
  return [...outbox]
}

export function flush(): number {
  const n = outbox.length
  outbox.length = 0
  return n
}

export function hail(principal: Principal): Notice {
  return enqueue(principal.addr, 'welcome', 'hello ' + principal.handle)
}

export function remindOpen(vault: Vault): number {
  const open = all(vault.indentures).filter(row => row.phase === 'open')
  for (const row of open) {
    const principal = vault.principals.get(row.principalId)
    if (!principal) {
      warn('herald.skip', { indentureId: row.id })
      continue
    }
    enqueue(principal.addr, 'tribute', 'indenture ' + row.id)
  }
  return open.length
}

export function digest(vault: Vault): Notice {
  const body = 'principals=' + vault.principals.size + ' indentures=' + vault.indentures.size
  return enqueue('ops@lodge.test', 'digest', body)
}

export function lastTo(addr: string): Notice | undefined {
  for (let i = outbox.length - 1; i >= 0; i--) if (outbox[i]!.to === addr) return outbox[i]
  return undefined
}
