import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Catalog = {
  id: string
  createdAt: number
  updatedAt: number
  slug: string
  title: string
  published: boolean
}

export type CatalogInput = {
  slug?: string
  title?: string
  published?: boolean
}

export const CATALOG_PREFIX = 'cat'

export function makeCatalog(input: CatalogInput = {}): Catalog {
  const at = now()
  return {
    id: nextId('cat'),
    createdAt: at,
    updatedAt: at,
    slug: input.slug ?? 'spring',
    title: input.title ?? 'Spring',
    published: input.published ?? false,
  }
}

export function touchCatalog(row: Catalog, patch: CatalogInput = {}): Catalog {
  const next = { ...row, updatedAt: now() }
  if (patch.slug !== undefined) next.slug = patch.slug
  if (patch.title !== undefined) next.title = patch.title
  if (patch.published !== undefined) next.published = patch.published
  return next
}

export function summarizeCatalog(row: Catalog): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isCatalog(value: unknown): value is Catalog {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Catalog).id === 'string'
}

export function sortCatalogs(rows: Catalog[]): Catalog[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
