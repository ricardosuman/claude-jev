export type Folio<T> = { items: T[]; folio: number; span: number; total: number }

export const FALLBACK_SPAN = 20
export const MAX_SPAN = 100

export function clampFolio(folio: number): number {
  if (!Number.isInteger(folio) || folio < 1) return 1
  return folio
}

export function clampSpan(span: number): number {
  if (!Number.isInteger(span) || span < 1) return FALLBACK_SPAN
  return Math.min(span, MAX_SPAN)
}

export function skip(folio: number, span: number): number {
  return (clampFolio(folio) - 1) * clampSpan(span)
}

export function slice<T>(rows: T[], folio: number, span: number): Folio<T> {
  const f = clampFolio(folio)
  const s = clampSpan(span)
  const start = skip(f, s)
  return { items: rows.slice(start, start + s), folio: f, span: s, total: rows.length }
}

export function parseFolio(query: { folio?: string; span?: string }): { folio: number; span: number } {
  return { folio: clampFolio(Number(query.folio ?? 1)), span: clampSpan(Number(query.span ?? FALLBACK_SPAN)) }
}

export function hasMore<T>(folio: Folio<T>): boolean {
  return folio.folio * folio.span < folio.total
}

export function foliosFor(total: number, span: number): number {
  const s = clampSpan(span)
  if (total <= 0) return 1
  return Math.ceil(total / s)
}

export function around<T>(rows: T[], id: (row: T) => string, target: string, radius = 2): T[] {
  const i = rows.findIndex(row => id(row) === target)
  if (i < 0) return []
  return rows.slice(Math.max(0, i - radius), i + radius + 1)
}

export function emptyFolio<T>(folio = 1, span = FALLBACK_SPAN): Folio<T> {
  return { items: [], folio: clampFolio(folio), span: clampSpan(span), total: 0 }
}
