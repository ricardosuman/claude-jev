import type { Store } from '../lib/store'
import { all } from '../lib/store'
import { info, warn } from '../lib/logger'
import { mask } from '../lib/hash'
import type { User } from '../models/user'

export type Notice = { to: string; subject: string; body: string; at: number }

const outbox: Notice[] = []

export function enqueue(to: string, subject: string, body: string): Notice {
  const notice = { to, subject, body, at: Date.now() }
  outbox.push(notice)
  info('notify.enqueue', { to: mask(to, 6), subject })
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

export function welcome(user: User): Notice {
  return enqueue(user.email, 'welcome', 'hello ' + user.name)
}

export function remindUnpaid(store: Store): number {
  const open = all(store.orders).filter(o => o.status === 'open')
  for (const order of open) {
    const user = store.users.get(order.userId)
    if (!user) {
      warn('notify.skip', { orderId: order.id })
      continue
    }
    enqueue(user.email, 'payment', 'order ' + order.id)
  }
  return open.length
}

export function digest(store: Store): Notice {
  const body = 'users=' + store.users.size + ' orders=' + store.orders.size
  return enqueue('ops@harbor.test', 'digest', body)
}

export function lastTo(email: string): Notice | undefined {
  for (let i = outbox.length - 1; i >= 0; i--) if (outbox[i]!.to === email) return outbox[i]
  return undefined
}
