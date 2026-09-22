import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeUser, sortUsers, touchUser, type User, type UserInput } from '../models/user'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<User> {
  const { page, limit } = parsePage(query)
  return slice(sortUsers(all(store.users)), page, limit)
}

export function get(store: Store, id: string): User | undefined {
  return store.users.get(id)
}

export function require(store: Store, id: string): User {
  const row = get(store, id)
  if (!row) throw notFound('user')
  return row
}


export function create(store: Store, input: UserInput): User {
  const row = makeUser(input)
  return put(store.users, row)
}

export function update(store: Store, id: string, patch: UserInput): User {
  const row = require(store, id)
  const next = touchUser(row, patch)
  info('user.update', { id })
  return put(store.users, next)
}

export function remove(store: Store, id: string): void {
  if (!store.users.delete(id)) throw notFound('user')
}

export function count(store: Store): number {
  return store.users.size
}

export function filter(store: Store, pred: (row: User) => boolean): User[] {
  return all(store.users).filter(pred)
}
