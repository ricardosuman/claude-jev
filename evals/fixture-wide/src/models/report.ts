import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type Report = {
  id: string
  createdAt: number
  updatedAt: number
  kind: string
  status: string
}

export type ReportInput = {
  kind?: string
  status?: string
}

export const REPORT_PREFIX = 'rpt'

export function makeReport(input: ReportInput = {}): Report {
  const at = now()
  return {
    id: nextId('rpt'),
    createdAt: at,
    updatedAt: at,
    kind: input.kind ?? 'sales',
    status: input.status ?? 'queued',
  }
}

export function touchReport(row: Report, patch: ReportInput = {}): Report {
  const next = { ...row, updatedAt: now() }
  if (patch.kind !== undefined) next.kind = patch.kind
  if (patch.status !== undefined) next.status = patch.status
  return next
}

export function summarizeReport(row: Report): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function isReport(value: unknown): value is Report {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as Report).id === 'string'
}

export function sortReports(rows: Report[]): Report[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
