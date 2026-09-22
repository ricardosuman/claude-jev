import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { makeTag, sortTags, touchTag, type Tag, type TagInput } from '../models/tag'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'

export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<Tag> {
  const { page, limit } = parsePage(query)
  return slice(sortTags(all(store.tags)), page, limit)
}

export function get(store: Store, id: string): Tag | undefined {
  return store.tags.get(id)
}

export function require(store: Store, id: string): Tag {
  const row = get(store, id)
  if (!row) throw notFound('tag')
  return row
}


export function create(store: Store, input: TagInput): Tag {
  const row = makeTag(input)
  return put(store.tags, row)
}

export function update(store: Store, id: string, patch: TagInput): Tag {
  const row = require(store, id)
  const next = touchTag(row, patch)
  info('tag.update', { id })
  return put(store.tags, next)
}

export function remove(store: Store, id: string): void {
  if (!store.tags.delete(id)) throw notFound('tag')
}

export function count(store: Store): number {
  return store.tags.size
}

export function filter(store: Store, pred: (row: Tag) => boolean): Tag[] {
  return all(store.tags).filter(pred)
}
