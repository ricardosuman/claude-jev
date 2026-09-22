export type Page<T> = { items: T[]; page: number; limit: number; total: number }

export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100

export function clampPage(page: number): number {
  if (!Number.isInteger(page) || page < 1) return 1
  return page
}

export function clampLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) return DEFAULT_LIMIT
  return Math.min(limit, MAX_LIMIT)
}

export function offset(page: number, limit: number): number {
  return (clampPage(page) - 1) * clampLimit(limit)
}

export function slice<T>(rows: T[], page: number, limit: number): Page<T> {
  const p = clampPage(page)
  const l = clampLimit(limit)
  const start = offset(p, l)
  return { items: rows.slice(start, start + l), page: p, limit: l, total: rows.length }
}

export function parsePage(query: { page?: string; limit?: string }): { page: number; limit: number } {
  return { page: clampPage(Number(query.page ?? 1)), limit: clampLimit(Number(query.limit ?? DEFAULT_LIMIT)) }
}

export function hasMore<T>(page: Page<T>): boolean {
  return page.page * page.limit < page.total
}

export function pagesFor(total: number, limit: number): number {
  const l = clampLimit(limit)
  if (total <= 0) return 1
  return Math.ceil(total / l)
}

export function around<T>(rows: T[], id: (row: T) => string, target: string, span = 2): T[] {
  const i = rows.findIndex(row => id(row) === target)
  if (i < 0) return []
  return rows.slice(Math.max(0, i - span), i + span + 1)
}

export function emptyPage<T>(page = 1, limit = DEFAULT_LIMIT): Page<T> {
  return { items: [], page: clampPage(page), limit: clampLimit(limit), total: 0 }
}
