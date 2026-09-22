// Emits evals/fixture-wide/. Idempotent overwrite. Run: bun evals/build-fixture-wide.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = join(import.meta.dir, 'fixture-wide')
const file = (rel: string, body: string) => {
  const path = join(root, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body.trimStart().replace(/^\n/, '') + (body.endsWith('\n') ? '' : '\n'))
}

file('package.json', `{
  "name": "harbor-fixture",
  "private": true,
  "type": "module",
  "scripts": { "test": "bun test" }
}
`)

file(
  'src/lib/errors.ts',
  `
export class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

export function badRequest(message: string): AppError {
  return new AppError(400, message)
}

export function notFound(what: string): AppError {
  return new AppError(404, what + ' not found')
}

export function conflict(message: string): AppError {
  return new AppError(409, message)
}

export function unauthorized(message = 'unauthorized'): AppError {
  return new AppError(401, message)
}

export function forbidden(message = 'forbidden'): AppError {
  return new AppError(403, message)
}

export function unprocessable(message: string): AppError {
  return new AppError(422, message)
}

export function tooMany(message = 'rate limited'): AppError {
  return new AppError(429, message)
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export function toBody(err: unknown): { status: number; error: string } {
  if (isAppError(err)) return { status: err.status, error: err.message }
  return { status: 500, error: err instanceof Error ? err.message : 'internal error' }
}
`,
)

file(
  'src/lib/http.ts',
  `
export type Result<T = unknown> = { status: number; body: T }

export function json<T>(body: T, status = 200): Result<T> {
  return { status, body }
}

export function noContent(): Result<null> {
  return { status: 204, body: null }
}

export function created<T>(body: T): Result<T> {
  return { status: 201, body }
}

export type Query = Record<string, string | undefined>

export function str(query: Query, key: string, fallback = ''): string {
  const value = query[key]
  return value === undefined || value === '' ? fallback : value
}

export function num(query: Query, key: string, fallback: number): number {
  const value = query[key]
  if (value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function bool(query: Query, key: string, fallback = false): boolean {
  const value = query[key]
  if (value === undefined) return fallback
  return value === '1' || value === 'true' || value === 'yes'
}

export function csv(query: Query, key: string): string[] {
  const value = str(query, key)
  if (!value) return []
  return value.split(',').map(part => part.trim()).filter(Boolean)
}

export function accepted<T>(body: T): Result<T> {
  return { status: 202, body }
}

export function methodIs(method: string, wanted: string): boolean {
  return method.toUpperCase() === wanted.toUpperCase()
}

export function hasQuery(query: Query, key: string): boolean {
  const value = query[key]
  return value !== undefined && value !== ''
}
`,
)

file(
  'src/lib/clock.ts',
  `
let offsetMs = 0

export function now(): number {
  return Date.now() + offsetMs
}

export function iso(ms: number = now()): string {
  return new Date(ms).toISOString()
}

export function advance(ms: number): void {
  offsetMs += ms
}

export function resetClock(): void {
  offsetMs = 0
}

export function elapsed(since: number, at: number = now()): number {
  return Math.max(0, at - since)
}

export function addMinutes(ms: number, minutes: number): number {
  return ms + minutes * 60_000
}

export function addHours(ms: number, hours: number): number {
  return ms + hours * 3_600_000
}

export function startOfUtcDay(ms: number = now()): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function isExpired(at: number, ttlMs: number, current: number = now()): boolean {
  return current - at >= ttlMs
}

export function addDays(ms: number, days: number): number {
  return ms + days * 86_400_000
}

export function minutesBetween(a: number, b: number): number {
  return Math.trunc(Math.abs(b - a) / 60_000)
}

export function isSameUtcDay(a: number, b: number): boolean {
  return startOfUtcDay(a) === startOfUtcDay(b)
}
`,
)

file(
  'src/lib/ids.ts',
  `
let seq = 0

export function nextId(prefix: string): string {
  seq += 1
  return prefix + '_' + seq.toString(16).padStart(6, '0')
}

export function resetIds(): void {
  seq = 0
}

export function peek(): number {
  return seq
}

export function isId(value: string, prefix?: string): boolean {
  if (prefix) return value.startsWith(prefix + '_') && value.length > prefix.length + 1
  return /^[a-z]+_[0-9a-f]+$/.test(value)
}

export function token(bytes = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < bytes; i++) out += chars[(seq + i * 17) % chars.length]
  return out
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function joinKey(...parts: string[]): string {
  return parts.map(p => p.replace(/:/g, '_')).join(':')
}

export function prefixOf(id: string): string {
  const i = id.indexOf('_')
  return i <= 0 ? '' : id.slice(0, i)
}

export function withoutPrefix(id: string): string {
  const i = id.indexOf('_')
  return i < 0 ? id : id.slice(i + 1)
}

export function nextIds(prefix: string, n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(nextId(prefix))
  return out
}
`,
)

file(
  'src/lib/pagination.ts',
  `
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
`,
)

file(
  'src/lib/logger.ts',
  `
export type Level = 'debug' | 'info' | 'warn' | 'error'

export type LogEvent = { at: number; level: Level; msg: string; fields: Record<string, unknown> }

const events: LogEvent[] = []
let min: Level = 'info'
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export function setLevel(level: Level): void {
  min = level
}

export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (order[level] < order[min]) return
  events.push({ at: Date.now(), level, msg, fields })
}

export function debug(msg: string, fields?: Record<string, unknown>): void {
  log('debug', msg, fields)
}

export function info(msg: string, fields?: Record<string, unknown>): void {
  log('info', msg, fields)
}

export function warn(msg: string, fields?: Record<string, unknown>): void {
  log('warn', msg, fields)
}

export function error(msg: string, fields?: Record<string, unknown>): void {
  log('error', msg, fields)
}

export function recent(n = 50): LogEvent[] {
  return events.slice(-n)
}

export function clearLogs(): void {
  events.length = 0
}

export function count(level?: Level): number {
  return level ? events.filter(e => e.level === level).length : events.length
}
`,
)

file(
  'src/lib/hash.ts',
  `
export function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function checksum(parts: string[]): string {
  return fnv1a(parts.join('|'))
}

export function mask(secret: string, keep = 4): string {
  if (secret.length <= keep) return '*'.repeat(secret.length)
  return '*'.repeat(secret.length - keep) + secret.slice(-keep)
}

export function timingEqual(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

export function fingerprint(obj: unknown): string {
  return fnv1a(stable(obj))
}

export function hex(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0')
}

export function combine(parts: string[]): string {
  return fnv1a(parts.join('\\0'))
}

export function startsMasked(secret: string, keep = 2): string {
  if (secret.length <= keep) return '*'.repeat(secret.length)
  return secret.slice(0, keep) + '*'.repeat(secret.length - keep)
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stable((value as Record<string, unknown>)[k])).join(',') + '}'
}
`,
)

file(
  'src/lib/csv.ts',
  `
export function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\\n]/.test(text)) return '"' + text.replaceAll('"', '""') + '"'
  return text
}

export function row(cells: unknown[]): string {
  return cells.map(escapeCell).join(',')
}

export function table(headers: string[], rows: unknown[][]): string {
  return [row(headers), ...rows.map(row)].join('\\n')
}

export function parseLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else cur += ch
  }
  cells.push(cur)
  return cells
}

export function parse(text: string): string[][] {
  return text.split(/\\r?\\n/).filter(line => line.length > 0).map(parseLine)
}

export function fromObjects(rows: Record<string, unknown>[], headers: string[]): string {
  return table(headers, rows.map(row => headers.map(h => row[h])))
}

export function toObjects(text: string): Record<string, string>[] {
  const lines = parse(text)
  const headers = lines[0]
  if (!headers) return []
  return lines.slice(1).map(cells => {
    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) row[headers[i]!] = cells[i] ?? ''
    return row
  })
}
`,
)

file(
  'src/lib/money.ts',
  `
export const MINOR: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, JPY: 0 }

export function minorUnits(currency: string): number {
  const n = MINOR[currency]
  if (n === undefined) throw new Error('unknown currency: ' + currency)
  return n
}

export function parseAmount(text: string, currency: string): number {
  const digits = minorUnits(currency)
  const n = Number(text)
  if (!Number.isFinite(n)) throw new Error('bad amount: ' + text)
  return Math.round(n * 10 ** digits)
}

export function formatAmount(minor: number, currency: string): string {
  const digits = minorUnits(currency)
  return (minor / 10 ** digits).toFixed(digits)
}

export function add(a: number, b: number): number {
  return a + b
}

export function sub(a: number, b: number): number {
  return a - b
}

export function pct(minor: number, basisPoints: number): number {
  return Math.trunc((minor * basisPoints) / 10_000)
}

export function clampMinor(minor: number): number {
  if (!Number.isInteger(minor)) throw new Error('amount must be integer minor units')
  return minor
}

export function sum(minors: number[]): number {
  let n = 0
  for (const m of minors) n += m
  return n
}

export function abs(minor: number): number {
  return minor < 0 ? -minor : minor
}

export function cmp(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function isZero(minor: number): boolean {
  return minor === 0
}
`,
)

file(
  'src/lib/retry.ts',
  `
export type RetryOpts = { attempts?: number; delayMs?: number; shouldRetry?: (err: unknown) => boolean }

export async function retry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const attempts = opts.attempts ?? 3
  const delayMs = opts.delayMs ?? 10
  const shouldRetry = opts.shouldRetry ?? (() => true)
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i === attempts - 1 || !shouldRetry(err)) throw err
      await sleep(delayMs * (i + 1))
    }
  }
  throw last
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function backoff(attempt: number, base = 25, cap = 1_000): number {
  return Math.min(cap, base * 2 ** attempt)
}

export function jitter(ms: number, spread = 0.2): number {
  const delta = ms * spread
  return Math.round(ms - delta + Math.random() * 2 * delta)
}

export function attemptsFor(errCount: number, max = 5): number {
  return Math.min(max, Math.max(1, errCount + 1))
}

export function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

export async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  return retry(fn, { attempts: 2, delayMs: 1 })
}
`,
)

file(
  'src/lib/validate.ts',
  `
import { badRequest } from './errors'

export function assertPresent(value: string | undefined, field: string): string {
  if (value === undefined || value.trim() === '') throw badRequest(field + ' is required')
  return value
}

export function assertEmail(value: string): string {
  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(value)) throw badRequest('invalid email')
  return value
}

export function assertPositive(n: number, field: string): number {
  if (!Number.isFinite(n) || n <= 0) throw badRequest(field + ' must be positive')
  return n
}

export function assertNonNegative(n: number, field: string): number {
  if (!Number.isFinite(n) || n < 0) throw badRequest(field + ' must be >= 0')
  return n
}

export function assertOneOf<T extends string>(value: string, allowed: readonly T[], field: string): T {
  if (!(allowed as readonly string[]).includes(value)) throw badRequest('invalid ' + field)
  return value as T
}

export function assertLen(value: string, min: number, max: number, field: string): string {
  if (value.length < min || value.length > max) throw badRequest(field + ' length')
  return value
}

export function assertInt(n: number, field: string): number {
  if (!Number.isInteger(n)) throw badRequest(field + ' must be an integer')
  return n
}

export function assertUrl(value: string): string {
  if (!/^https?:\\/\\//.test(value)) throw badRequest('invalid url')
  return value
}

export function clampStr(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max)
}
`,
)

file(
  'src/lib/store.ts',
  `
import type { User } from '../models/user'
import type { Order } from '../models/order'
import type { Item } from '../models/item'
import type { Inventory } from '../models/inventory'
import type { Session } from '../models/session'
import type { Note } from '../models/note'
import type { Tag } from '../models/tag'
import type { Audit } from '../models/audit'
import type { Shipment } from '../models/shipment'
import type { Webhook } from '../models/webhook'
import type { Report } from '../models/report'
import type { Catalog } from '../models/catalog'

export type Store = {
  users: Map<string, User>
  orders: Map<string, Order>
  items: Map<string, Item>
  inventory: Map<string, Inventory>
  sessions: Map<string, Session>
  notes: Map<string, Note>
  tags: Map<string, Tag>
  audit: Map<string, Audit>
  shipments: Map<string, Shipment>
  webhooks: Map<string, Webhook>
  reports: Map<string, Report>
  catalog: Map<string, Catalog>
}

export function createStore(): Store {
  return {
    users: new Map(),
    orders: new Map(),
    items: new Map(),
    inventory: new Map(),
    sessions: new Map(),
    notes: new Map(),
    tags: new Map(),
    audit: new Map(),
    shipments: new Map(),
    webhooks: new Map(),
    reports: new Map(),
    catalog: new Map(),
  }
}

export function all<T>(map: Map<string, T>): T[] {
  return [...map.values()]
}

export function put<T extends { id: string }>(map: Map<string, T>, row: T): T {
  map.set(row.id, row)
  return row
}

export function drop(map: Map<string, unknown>, id: string): boolean {
  return map.delete(id)
}

export function size(store: Store): Record<string, number> {
  return {
    users: store.users.size,
    orders: store.orders.size,
    items: store.items.size,
    inventory: store.inventory.size,
    sessions: store.sessions.size,
    notes: store.notes.size,
    tags: store.tags.size,
    audit: store.audit.size,
    shipments: store.shipments.size,
    webhooks: store.webhooks.size,
    reports: store.reports.size,
    catalog: store.catalog.size,
  }
}

export function clear(store: Store): void {
  for (const map of Object.values(store)) map.clear()
}
`,
)

type Entity = {
  name: string
  Name: string
  prefix: string
  fields: { key: string; type: string; sample: string }[]
}

const entities: Entity[] = [
  { name: 'user', Name: 'User', prefix: 'usr', fields: [
    { key: 'email', type: 'string', sample: "'ada@harbor.test'" },
    { key: 'name', type: 'string', sample: "'Ada'" },
    { key: 'role', type: 'string', sample: "'member'" },
  ]},
  { name: 'order', Name: 'Order', prefix: 'ord', fields: [
    { key: 'userId', type: 'string', sample: "'usr_1'" },
    { key: 'status', type: 'string', sample: "'open'" },
    { key: 'total', type: 'number', sample: '0' },
  ]},
  { name: 'item', Name: 'Item', prefix: 'itm', fields: [
    { key: 'sku', type: 'string', sample: "'SKU0001'" },
    { key: 'name', type: 'string', sample: "'widget'" },
    { key: 'price', type: 'string', sample: "'9.00'" },
  ]},
  { name: 'inventory', Name: 'Inventory', prefix: 'inv', fields: [
    { key: 'itemId', type: 'string', sample: "'itm_1'" },
    { key: 'location', type: 'string', sample: "'A1'" },
    { key: 'qty', type: 'number', sample: '0' },
  ]},
  { name: 'session', Name: 'Session', prefix: 'ses', fields: [
    { key: 'userId', type: 'string', sample: "'usr_1'" },
    { key: 'token', type: 'string', sample: "'tok'" },
    { key: 'revokedAt', type: 'number | null', sample: 'null' },
  ]},
  { name: 'note', Name: 'Note', prefix: 'nte', fields: [
    { key: 'userId', type: 'string', sample: "'usr_1'" },
    { key: 'body', type: 'string', sample: "''" },
    { key: 'pinned', type: 'boolean', sample: 'false' },
  ]},
  { name: 'tag', Name: 'Tag', prefix: 'tag', fields: [
    { key: 'name', type: 'string', sample: "'inbox'" },
    { key: 'color', type: 'string', sample: "'gray'" },
  ]},
  { name: 'audit', Name: 'Audit', prefix: 'aud', fields: [
    { key: 'actorId', type: 'string', sample: "'usr_1'" },
    { key: 'action', type: 'string', sample: "'read'" },
    { key: 'target', type: 'string', sample: "''" },
  ]},
  { name: 'shipment', Name: 'Shipment', prefix: 'shp', fields: [
    { key: 'orderId', type: 'string', sample: "'ord_1'" },
    { key: 'status', type: 'string', sample: "'pending'" },
    { key: 'carrier', type: 'string', sample: "'dhl'" },
    { key: 'tracking', type: 'string', sample: "''" },
  ]},
  { name: 'webhook', Name: 'Webhook', prefix: 'whk', fields: [
    { key: 'url', type: 'string', sample: "'https://example.test/hook'" },
    { key: 'event', type: 'string', sample: "'order.paid'" },
    { key: 'secret', type: 'string', sample: "'s'" },
  ]},
  { name: 'report', Name: 'Report', prefix: 'rpt', fields: [
    { key: 'kind', type: 'string', sample: "'sales'" },
    { key: 'status', type: 'string', sample: "'queued'" },
  ]},
  { name: 'catalog', Name: 'Catalog', prefix: 'cat', fields: [
    { key: 'slug', type: 'string', sample: "'spring'" },
    { key: 'title', type: 'string', sample: "'Spring'" },
    { key: 'published', type: 'boolean', sample: 'false' },
  ]},
]

const typeFields = (e: Entity) =>
  e.fields.map(f => `  ${f.key}: ${f.type}`).join('\n')

const inputFields = (e: Entity) =>
  e.fields.map(f => `  ${f.key}?: ${f.type}`).join('\n')

const assignFields = (e: Entity) =>
  e.fields.map(f => `    ${f.key}: input.${f.key} ?? ${f.sample},`).join('\n')

const patchFields = (e: Entity) =>
  e.fields.map(f => `  if (patch.${f.key} !== undefined) next.${f.key} = patch.${f.key}`).join('\n')

for (const e of entities) {
  const fileName = e.name === 'catalog' ? 'catalog' : e.name
  file(
    `src/models/${fileName}.ts`,
    `
import { nextId } from '../lib/ids'
import { now } from '../lib/clock'

export type ${e.Name} = {
  id: string
  createdAt: number
  updatedAt: number
${typeFields(e)}
}

export type ${e.Name}Input = {
${inputFields(e)}
}

export const ${e.name.toUpperCase()}_PREFIX = '${e.prefix}'

export function make${e.Name}(input: ${e.Name}Input = {}): ${e.Name} {
  const at = now()
  return {
    id: nextId('${e.prefix}'),
    createdAt: at,
    updatedAt: at,
${assignFields(e)}
  }
}

export function touch${e.Name}(row: ${e.Name}, patch: ${e.Name}Input = {}): ${e.Name} {
  const next = { ...row, updatedAt: now() }
${patchFields(e)}
  return next
}

export function summarize${e.Name}(row: ${e.Name}): Record<string, unknown> {
  return { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

export function is${e.Name}(value: unknown): value is ${e.Name} {
  return !!value && typeof value === 'object' && 'id' in value && typeof (value as ${e.Name}).id === 'string'
}

export function sort${e.Name}s(rows: ${e.Name}[]): ${e.Name}[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt)
}
`,
  )
}

const storeKey: Record<string, string> = {
  user: 'users',
  order: 'orders',
  item: 'items',
  inventory: 'inventory',
  session: 'sessions',
  note: 'notes',
  tag: 'tags',
  audit: 'audit',
  shipment: 'shipments',
  webhook: 'webhooks',
  report: 'reports',
  catalog: 'catalog',
}

for (const e of entities) {
  const key = storeKey[e.name]!
  const extra =
    e.name === 'item'
      ? `
export function create(store: Store, input: ${e.Name}Input): ${e.Name} {
  assertPresent(input.sku, 'sku')
  assertPresent(input.name, 'name')
  const row = make${e.Name}(input)
  return put(store.${key}, row)
}
`
      : e.name === 'session'
        ? `
export function create(store: Store, input: ${e.Name}Input): ${e.Name} {
  assertPresent(input.userId, 'userId')
  const row = make${e.Name}({ ...input, token: input.token ?? token(20), revokedAt: null })
  return put(store.${key}, row)
}

export function revoke(store: Store, id: string): ${e.Name} {
  const row = get(store, id)
  if (!row) throw notFound('${e.name}')
  return put(store.${key}, touch${e.Name}(row, { revokedAt: now() }))
}
`
        : e.name === 'shipment'
          ? `
export function create(store: Store, input: ${e.Name}Input): ${e.Name} {
  assertPresent(input.orderId, 'orderId')
  const tracking = input.tracking && input.tracking.length > 0 ? input.tracking : 'TRK-' + token(10)
  const row = make${e.Name}({ ...input, status: input.status ?? 'pending', tracking })
  return put(store.${key}, row)
}
`
          : `
export function create(store: Store, input: ${e.Name}Input): ${e.Name} {
  const row = make${e.Name}(input)
  return put(store.${key}, row)
}
`

  const imports =
    (e.name === 'session' || e.name === 'shipment' ? `import { token } from '../lib/ids'\n` : '') +
    (e.name === 'session' ? `import { now } from '../lib/clock'\n` : '') +
    (e.name === 'item' || e.name === 'session' || e.name === 'shipment'
      ? `import { assertPresent } from '../lib/validate'\n`
      : '')

  const catalogConst = e.name === 'catalog' ? `\nexport const CATALOG_SYNC_BATCH = 40\n` : ''

  file(
    `src/services/${e.name}Service.ts`,
    `
import type { Store } from '../lib/store'
import { all, put } from '../lib/store'
import { make${e.Name}, sort${e.Name}s, touch${e.Name}, type ${e.Name}, type ${e.Name}Input } from '../models/${e.name}'
import { notFound } from '../lib/errors'
import { slice, parsePage, type Page } from '../lib/pagination'
import { info } from '../lib/logger'
${imports}${catalogConst}
export function list(store: Store, query: { page?: string; limit?: string } = {}): Page<${e.Name}> {
  const { page, limit } = parsePage(query)
  return slice(sort${e.Name}s(all(store.${key})), page, limit)
}

export function get(store: Store, id: string): ${e.Name} | undefined {
  return store.${key}.get(id)
}

export function require(store: Store, id: string): ${e.Name} {
  const row = get(store, id)
  if (!row) throw notFound('${e.name}')
  return row
}

${extra}
export function update(store: Store, id: string, patch: ${e.Name}Input): ${e.Name} {
  const row = require(store, id)
  const next = touch${e.Name}(row, patch)
  info('${e.name}.update', { id })
  return put(store.${key}, next)
}

export function remove(store: Store, id: string): void {
  if (!store.${key}.delete(id)) throw notFound('${e.name}')
}

export function count(store: Store): number {
  return store.${key}.size
}

export function filter(store: Store, pred: (row: ${e.Name}) => boolean): ${e.Name}[] {
  return all(store.${key}).filter(pred)
}
`,
  )
}

file(
  'src/services/notifyService.ts',
  `
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
`,
)

const routeExtra: Record<string, string> = {
  session: `
export function revoke(store: Store, id: string): Result {
  const session = sessions.get(store, id)
  if (!session) throw notFound('session')
  if (session.revokedAt) throw conflict('already revoked')
  return json(sessions.revoke(store, id))
}

export function touch(store: Store, id: string): Result {
  const session = sessions.require(store, id)
  return json(session)
}
`,
  shipment: `
export function createShipment(store: Store, input: Parameters<typeof shipments.create>[1]): Result {
  return created(shipments.create(store, input))
}

export function markShipped(store: Store, id: string, tracking: string): Result {
  return json(shipments.update(store, id, { status: 'shipped', tracking }))
}
`,
  order: `
export function cancel(store: Store, id: string): Result {
  const order = orders.get(store, id)
  if (!order) throw notFound('order')
  if (order.status === 'cancelled') throw conflict('already cancelled')
  return json(orders.update(store, id, { status: 'cancelled' }))
}
`,
  webhook: `
export function disable(store: Store, id: string): Result {
  const hook = webhooks.get(store, id)
  if (!hook) throw notFound('webhook')
  if (hook.event === 'disabled') throw conflict('already disabled')
  return json(webhooks.update(store, id, { event: 'disabled' }))
}
`,
}

file(
  'src/routes/health.ts',
  `
import { json, type Result } from '../lib/http'
import { size, type Store } from '../lib/store'
import { iso, now } from '../lib/clock'
import { recent } from '../lib/logger'
import { loadApp } from '../../config/app'
import { loadServer } from '../../config/server'

export function health(): Result {
  const app = loadApp()
  return json({ ok: true, name: app.name, env: app.env, at: iso() })
}

export function ready(store: Store): Result {
  return json({ ok: true, counts: size(store) })
}

export function live(): Result {
  return json({ ok: true, uptimeHint: now() })
}

export function version(): Result {
  const server = loadServer()
  return json({ host: server.host, port: server.port })
}

export function logs(): Result {
  return json({ events: recent(20) })
}

export function ping(): Result {
  return json({ pong: true })
}

export function info(): Result {
  return json({ app: loadApp(), server: loadServer() })
}

export function counts(store: Store): Result {
  const c = size(store)
  return json({ total: Object.values(c).reduce((a, b) => a + b, 0), c })
}

export function recentErrors(): Result {
  return json({ events: recent(50).filter(e => e.level === 'error' || e.level === 'warn') })
}
`,
)

for (const e of entities) {
  const svc = `${e.name}s`
  const extra = routeExtra[e.name] ?? ''
  file(
    `src/routes/${storeKey[e.name]}.ts`,
    `
import { json, created, noContent, type Query, type Result } from '../lib/http'
import { notFound, conflict } from '../lib/errors'
import type { Store } from '../lib/store'
import * as ${svc} from '../services/${e.name}Service'
import type { ${e.Name}Input } from '../models/${e.name}'

export function list(store: Store, query: Query = {}): Result {
  return json(${svc}.list(store, query))
}

export function get(store: Store, id: string): Result {
  const row = ${svc}.get(store, id)
  if (!row) throw notFound('${e.name}')
  return json(row)
}

export function create(store: Store, input: ${e.Name}Input): Result {
  return created(${svc}.create(store, input))
}

export function update(store: Store, id: string, input: ${e.Name}Input): Result {
  return json(${svc}.update(store, id, input))
}

export function remove(store: Store, id: string): Result {
  ${svc}.remove(store, id)
  return noContent()
}

export function count(store: Store): Result {
  return json({ count: ${svc}.count(store) })
}

export function exists(store: Store, id: string): Result {
  return json({ exists: ${svc}.get(store, id) !== undefined })
}

export function require(store: Store, id: string): Result {
  return json(${svc}.require(store, id))
}

export function search(store: Store, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = ${svc}.filter(store, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(store: Store): Result {
  return json(${svc}.list(store, { page: '1', limit: '100' }).items.map(row => row.id))
}
${extra}
`,
  )
}

type Setting = { key: string; env: string; def: string; num?: boolean; bool?: boolean }

const configs: { file: string; load: string; settings: Setting[]; extra: string }[] = [
  { file: 'app', load: 'loadApp', settings: [
    { key: 'name', env: 'APP_NAME', def: "'harbor'" },
    { key: 'env', env: 'APP_ENV', def: "'test'" },
    { key: 'logLevel', env: 'LOG_LEVEL', def: "'info'" },
    { key: 'release', env: 'RELEASE', def: "'dev'" },
  ], extra: 'export const APP_ID = \'harbor-api\'\n' },
  { file: 'server', load: 'loadServer', settings: [
    { key: 'host', env: 'HOST', def: "'127.0.0.1'" },
    { key: 'port', env: 'PORT', def: '3000', num: true },
    { key: 'keepAliveSec', env: 'KEEP_ALIVE_SEC', def: '65', num: true },
    { key: 'trustProxy', env: 'TRUST_PROXY', def: 'false', bool: true },
  ], extra: 'export const DEFAULT_PORT = 3000\n' },
  { file: 'database', load: 'loadDatabase', settings: [
    { key: 'url', env: 'DATABASE_URL', def: "'memory://harbor'" },
    { key: 'pool', env: 'DATABASE_POOL', def: '5', num: true },
    { key: 'slowMs', env: 'DATABASE_SLOW_MS', def: '200', num: true },
    { key: 'ssl', env: 'DATABASE_SSL', def: 'false', bool: true },
  ], extra: 'export const MIGRATIONS_TABLE = \'schema_migrations\'\n' },
  { file: 'cache', load: 'loadCache', settings: [
    { key: 'url', env: 'CACHE_URL', def: "'memory://cache'" },
    { key: 'ttlSec', env: 'CACHE_TTL_SEC', def: '60', num: true },
    { key: 'prefix', env: 'CACHE_PREFIX', def: "'hbr'" },
    { key: 'windowSec', env: 'CACHE_WINDOW_SEC', def: '15', num: true },
  ], extra: 'export const CACHE_NULL_TTL_SEC = 5\n' },
  { file: 'mail', load: 'loadMail', settings: [
    { key: 'from', env: 'MAIL_FROM', def: "'ops@harbor.test'" },
    { key: 'host', env: 'MAIL_HOST', def: "'localhost'" },
    { key: 'port', env: 'MAIL_PORT', def: '1025', num: true },
    { key: 'retryWindowSec', env: 'MAIL_RETRY_WINDOW_SEC', def: '15', num: true },
  ], extra: 'export const MAIL_BATCH = 25\n' },
  { file: 'billing', load: 'loadBilling', settings: [
    { key: 'currency', env: 'BILLING_CURRENCY', def: "'USD'" },
    { key: 'reconcileWindowMin', env: 'RECONCILE_WINDOW_MIN', def: '47', num: true },
    { key: 'statementDay', env: 'BILLING_STATEMENT_DAY', def: '1', num: true },
    { key: 'graceDays', env: 'BILLING_GRACE_DAYS', def: '5', num: true },
    { key: 'captureHoldMin', env: 'CAPTURE_HOLD_MIN', def: '20', num: true },
  ], extra: `export const BILLING_MINOR_DIGITS = 2

/** Minutes a scheduled job waits before re-checking records that have already settled. */
export function settledRecheckDelayMin(cfg: BillingConfig): number {
  return cfg.reconcileWindowMin
}
` },
  { file: 'flags', load: 'loadFlags', settings: [
    { key: 'newCheckout', env: 'FLAG_NEW_CHECKOUT', def: 'false', bool: true },
    { key: 'auditVerbose', env: 'FLAG_AUDIT_VERBOSE', def: 'true', bool: true },
    { key: 'shipmentsV2', env: 'FLAG_SHIPMENTS_V2', def: 'false', bool: true },
    { key: 'windowPreview', env: 'FLAG_WINDOW_PREVIEW', def: 'false', bool: true },
  ], extra: 'export const FLAG_SOURCE = \'env\'\n' },
  { file: 'limits', load: 'loadLimits', settings: [
    { key: 'catalogPageSize', env: 'CATALOG_PAGE_SIZE', def: '20', num: true },
    { key: 'uploadMb', env: 'UPLOAD_MB', def: '8', num: true },
    { key: 'noteMax', env: 'NOTE_MAX', def: '4000', num: true },
    { key: 'windowItems', env: 'LIMIT_WINDOW_ITEMS', def: '500', num: true },
  ], extra: 'export const HARD_ITEM_CAP = 10_000\n' },
  { file: 'regions', load: 'loadRegions', settings: [
    { key: 'home', env: 'REGION_HOME', def: "'us-east'" },
    { key: 'failover', env: 'REGION_FAILOVER', def: "'us-west'" },
    { key: 'windowTz', env: 'REGION_WINDOW_TZ', def: "'UTC'" },
    { key: 'strict', env: 'REGION_STRICT', def: 'false', bool: true },
  ], extra: "export const KNOWN_REGIONS = ['us-east', 'us-west', 'eu-west'] as const\n" },
  { file: 'queue', load: 'loadQueue', settings: [
    { key: 'url', env: 'QUEUE_URL', def: "'memory://queue'" },
    { key: 'visibilitySec', env: 'QUEUE_VISIBILITY_SEC', def: '30', num: true },
    { key: 'windowSec', env: 'QUEUE_WINDOW_SEC', def: '12', num: true },
    { key: 'workers', env: 'QUEUE_WORKERS', def: '2', num: true },
  ], extra: "export const QUEUE_NAMES = ['mail', 'webhooks', 'reports'] as const\n" },
  { file: 'storage', load: 'loadStorage', settings: [
    { key: 'bucket', env: 'STORAGE_BUCKET', def: "'harbor-local'" },
    { key: 'region', env: 'STORAGE_REGION', def: "'local'" },
    { key: 'prefix', env: 'STORAGE_PREFIX', def: "'dev/'" },
    { key: 'windowSec', env: 'STORAGE_SIGNED_WINDOW_SEC', def: '90', num: true },
  ], extra: 'export const STORAGE_MAX_KEYS = 1000\n' },
  { file: 'ratelimit', load: 'loadRateLimit', settings: [
    { key: 'windowSec', env: 'RATE_WINDOW_SEC', def: '60', num: true },
    { key: 'burst', env: 'RATE_BURST', def: '40', num: true },
    { key: 'loginWindowSec', env: 'LOGIN_WINDOW_SEC', def: '300', num: true },
    { key: 'loginBurst', env: 'LOGIN_BURST', def: '8', num: true },
  ], extra: 'export const RATE_LIMIT_HEADER = \'x-ratelimit-remaining\'\n' },
]

function readSetting(s: Setting): string {
  if (s.num) return `Number(env.${s.env} ?? ${s.def})`
  if (s.bool) return `env.${s.env} === '1' || env.${s.env} === 'true' ? true : env.${s.env} === '0' || env.${s.env} === 'false' ? false : ${s.def}`
  return `env.${s.env} ?? ${s.def}`
}

for (const c of configs) {
  const typeName = c.load.replace('load', '') + 'Config'
  const fields = c.settings.map(s => `  ${s.key}: ${s.num ? 'number' : s.bool ? 'boolean' : 'string'}`).join('\n')
  const assigns = c.settings.map(s => `    ${s.key}: ${readSetting(s)},`).join('\n')
  const docs = c.settings.map(s => ` * ${s.env} — ${s.key} (default ${s.def})`).join('\n')
  file(
    `config/${c.file}.ts`,
    `
export type ${typeName} = {
${fields}
}

${c.extra}
/**
 * Environment keys:
${docs}
 */
export function ${c.load}(env: Record<string, string | undefined> = process.env): ${typeName} {
  return {
${assigns}
  }
}

export function freeze${typeName}(cfg: ${typeName}): Readonly<${typeName}> {
  return Object.freeze({ ...cfg })
}

export function describe${typeName}(cfg: ${typeName}): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function merge${typeName}(base: ${typeName}, patch: Partial<${typeName}>): ${typeName} {
  return { ...base, ...patch }
}

export function pick${typeName}<K extends keyof ${typeName}>(cfg: ${typeName}, keys: K[]): Pick<${typeName}, K> {
  const out = {} as Pick<${typeName}, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
`,
  )
}

file(
  'src/app.ts',
  `
import type { Store } from './lib/store'
import { isAppError, toBody } from './lib/errors'
import { json, type Query, type Result } from './lib/http'
import * as health from './routes/health'
import * as users from './routes/users'
import * as orders from './routes/orders'
import * as items from './routes/items'
import * as inventory from './routes/inventory'
import * as sessions from './routes/sessions'
import * as notes from './routes/notes'
import * as tags from './routes/tags'
import * as audit from './routes/audit'
import * as shipments from './routes/shipments'
import * as webhooks from './routes/webhooks'
import * as reports from './routes/reports'
import * as catalog from './routes/catalog'
import { loadApp } from '../config/app'
import { loadServer } from '../config/server'
import { info } from './lib/logger'

export type Request = { method: string; path: string; query?: Query; body?: unknown; params?: Record<string, string> }

export function describeApp(): { name: string; port: number } {
  return { name: loadApp().name, port: loadServer().port }
}

export function dispatch(store: Store, req: Request): Result {
  try {
    info('http', { method: req.method, path: req.path })
    const result = match(store, req)
    return result ?? json({ error: 'not found' }, 404)
  } catch (err) {
    if (isAppError(err)) return json({ error: err.message }, err.status)
    const body = toBody(err)
    return json({ error: body.error }, body.status)
  }
}

function match(store: Store, req: Request): Result | undefined {
  const { method, path } = req
  const query = req.query ?? {}
  const params = req.params ?? {}
  const body = (req.body ?? {}) as Record<string, unknown>
  if (method === 'GET' && path === '/health') return health.health()
  if (method === 'GET' && path === '/ready') return health.ready(store)
  if (method === 'GET' && path === '/users') return users.list(store, query)
  if (method === 'GET' && path === '/orders') return orders.list(store, query)
  if (method === 'GET' && path === '/items') return items.list(store, query)
  if (method === 'POST' && path === '/items') return items.create(store, body)
  if (method === 'GET' && path === '/sessions') return sessions.list(store, query)
  if (method === 'POST' && path.startsWith('/sessions/') && path.endsWith('/revoke')) return sessions.revoke(store, params.id ?? path.split('/')[2]!)
  if (method === 'GET' && path === '/shipments') return shipments.list(store, query)
  if (method === 'POST' && path === '/shipments') return shipments.create(store, body)
  if (method === 'GET' && path === '/notes') return notes.list(store, query)
  if (method === 'GET' && path === '/catalog') return catalog.list(store, query)
  if (method === 'GET' && path === '/webhooks') return webhooks.list(store, query)
  if (method === 'GET' && path === '/reports') return reports.list(store, query)
  if (method === 'GET' && path === '/tags') return tags.list(store, query)
  if (method === 'GET' && path === '/audit') return audit.list(store, query)
  if (method === 'GET' && path === '/inventory') return inventory.list(store, query)
  return undefined
}
`,
)

file(
  'src/index.ts',
  `
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
`,
)

const scripts = [
  ['seed', `
import { createStore, put, size, type Store } from '../src/lib/store'
import { makeUser } from '../src/models/user'
import { makeItem } from '../src/models/item'
import { makeOrder } from '../src/models/order'
import { makeShipment } from '../src/models/shipment'
import { makeNote } from '../src/models/note'
import { makeTag } from '../src/models/tag'
import { info } from '../src/lib/logger'

const SKUS = ['WIDG0001', 'WIDG0002', 'BOLT0001', 'NUT00001']

export function seedUser(store: Store, email: string, name: string, role = 'member') {
  return put(store.users, makeUser({ email, name, role }))
}

export function seedItem(store: Store, sku: string, name: string, price = '9.00') {
  return put(store.items, makeItem({ sku, name, price }))
}

export function seedOrder(store: Store, userId: string, total = 900) {
  return put(store.orders, makeOrder({ userId, status: 'open', total }))
}

export function seedNote(store: Store, userId: string, body: string) {
  return put(store.notes, makeNote({ userId, body }))
}

export function seedTag(store: Store, name: string, color = 'gray') {
  return put(store.tags, makeTag({ name, color }))
}

export function seedShipment(store: Store, orderId: string, carrier = 'dhl') {
  return put(store.shipments, makeShipment({ orderId, status: 'pending', carrier }))
}

export function skus(): string[] {
  return [...SKUS]
}

export function seed() {
  const store = createStore()
  const user = seedUser(store, 'ada@harbor.test', 'Ada', 'admin')
  seedUser(store, 'al@harbor.test', 'Al')
  for (const sku of SKUS) seedItem(store, sku, sku.toLowerCase())
  const order = seedOrder(store, user.id)
  seedShipment(store, order.id)
  seedNote(store, user.id, 'first')
  seedTag(store, 'inbox')
  info('seed', size(store))
  return store
}

if (import.meta.main) seed()
`],
  ['migrate', `
import { loadDatabase } from '../config/database'
import { info, warn } from '../src/lib/logger'

export const STEPS = ['init', 'users', 'orders', 'items', 'shipments', 'audit'] as const

export type Step = (typeof STEPS)[number]

export function indexOf(step: Step): number {
  return STEPS.indexOf(step)
}

export function migrate(to: Step = STEPS[STEPS.length - 1]!) {
  const db = loadDatabase()
  const applied: Step[] = []
  for (const step of STEPS) {
    applied.push(step)
    info('migrate', { step, url: db.url, pool: db.pool })
    if (step === to) break
  }
  return applied
}

export function pending(applied: Step[]): Step[] {
  const last = applied[applied.length - 1]
  if (!last) return [...STEPS]
  return STEPS.slice(indexOf(last) + 1)
}

export function dryRun(to: Step): string[] {
  const db = loadDatabase()
  if (!db.url) warn('migrate.nodb', {})
  return migrate(to)
}

export function isStep(value: string): value is Step {
  return (STEPS as readonly string[]).includes(value)
}

export function nextStep(applied: Step[]): Step | undefined {
  return pending(applied)[0]
}

export function describe(applied: Step[]): string {
  return applied.join('>')
}

if (import.meta.main) migrate()
`],
  ['backup', `
import { createStore, all, size, type Store } from '../src/lib/store'
import { table } from '../src/lib/csv'
import { info } from '../src/lib/logger'
import { iso } from '../src/lib/clock'

export function dumpUsers(store: Store): string {
  return table(['id', 'email', 'role'], all(store.users).map(u => [u.id, u.email, u.role]))
}

export function dumpOrders(store: Store): string {
  return table(['id', 'userId', 'status', 'total'], all(store.orders).map(o => [o.id, o.userId, o.status, o.total]))
}

export function dumpItems(store: Store): string {
  return table(['id', 'sku', 'name'], all(store.items).map(i => [i.id, i.sku, i.name]))
}

export function dumpNotes(store: Store): string {
  return table(['id', 'userId', 'pinned'], all(store.notes).map(n => [n.id, n.userId, n.pinned]))
}

export function dumpTags(store: Store): string {
  return table(['id', 'name', 'color'], all(store.tags).map(t => [t.id, t.name, t.color]))
}

export function backup(store = createStore()) {
  const payload = {
    at: iso(),
    users: dumpUsers(store),
    orders: dumpOrders(store),
    items: dumpItems(store),
    notes: dumpNotes(store),
    tags: dumpTags(store),
  }
  info('backup', size(store))
  return payload
}

export function empty(): boolean {
  return backup().users.split('\\n').length <= 1
}

export function stamp(): string {
  return 'backup-' + iso().replaceAll(':', '')
}

if (import.meta.main) backup()
`],
  ['prune', `
import { createStore, all, type Store } from '../src/lib/store'
import { now, addHours } from '../src/lib/clock'
import { info } from '../src/lib/logger'

export function pruneSessions(store: Store, cutoff: number): number {
  let n = 0
  for (const session of all(store.sessions)) {
    if (session.revokedAt && session.revokedAt < cutoff) {
      store.sessions.delete(session.id)
      n++
    }
  }
  return n
}

export function pruneNotes(store: Store, cutoff: number): number {
  let n = 0
  for (const note of all(store.notes)) {
    if (note.createdAt < cutoff && !note.pinned) {
      store.notes.delete(note.id)
      n++
    }
  }
  return n
}

export function pruneReports(store: Store, cutoff: number): number {
  let n = 0
  for (const row of all(store.reports)) {
    if (row.createdAt < cutoff && row.status === 'queued') {
      store.reports.delete(row.id)
      n++
    }
  }
  return n
}

export function cutoffFromHours(olderThanHours: number): number {
  return addHours(now(), -olderThanHours)
}

export function prune(store = createStore(), olderThanHours = 24) {
  const cutoff = cutoffFromHours(olderThanHours)
  const sessions = pruneSessions(store, cutoff)
  const notes = pruneNotes(store, cutoff)
  const reports = pruneReports(store, cutoff)
  info('prune', { sessions, notes, reports, olderThanHours })
  return sessions + notes + reports
}

if (import.meta.main) prune()
`],
  ['export', `
import { createStore, all, type Store } from '../src/lib/store'
import { table } from '../src/lib/csv'
import { loadStorage } from '../config/storage'
import { loadLimits } from '../config/limits'
import { info } from '../src/lib/logger'

export function catalogCsv(store: Store): string {
  return table(['id', 'slug', 'title', 'published'], all(store.catalog).map(c => [c.id, c.slug, c.title, c.published]))
}

export function itemsCsv(store: Store): string {
  return table(['id', 'sku', 'name', 'price'], all(store.items).map(i => [i.id, i.sku, i.name, i.price]))
}

export function usersCsv(store: Store): string {
  return table(['id', 'email', 'role'], all(store.users).map(u => [u.id, u.email, u.role]))
}

export function ordersCsv(store: Store): string {
  return table(['id', 'userId', 'status', 'total'], all(store.orders).map(o => [o.id, o.userId, o.status, o.total]))
}

export function exportCatalog(store = createStore()) {
  const storage = loadStorage()
  const limits = loadLimits()
  const csv = catalogCsv(store)
  info('export.catalog', { bucket: storage.bucket, prefix: storage.prefix, page: limits.catalogPageSize })
  return { bucket: storage.bucket, csv }
}

export function exportItems(store = createStore()) {
  return { csv: itemsCsv(store) }
}

export function exportAll(store = createStore()) {
  return { users: usersCsv(store), orders: ordersCsv(store), items: itemsCsv(store), catalog: catalogCsv(store) }
}

export function exportUsers(store = createStore()) {
  return { csv: usersCsv(store) }
}

if (import.meta.main) exportCatalog()
`],
  ['healthcheck', `
import { loadServer } from '../config/server'
import { loadApp } from '../config/app'
import { loadDatabase } from '../config/database'
import { health, ping } from '../src/routes/health'

export type Check = { ok: boolean; name: string; detail: string }

export function checkApp(): Check {
  const app = loadApp()
  return { ok: !!app.name, name: 'app', detail: app.env }
}

export function checkServer(): Check {
  const server = loadServer()
  return { ok: server.port > 0, name: 'server', detail: server.host + ':' + server.port }
}

export function checkDb(): Check {
  const db = loadDatabase()
  return { ok: db.url.length > 0, name: 'database', detail: db.url }
}

export function checkRoutes(): Check {
  const res = health()
  const pong = ping()
  return { ok: res.status === 200 && pong.status === 200, name: 'routes', detail: String(res.status) }
}

export function failed(parts: Check[]): Check[] {
  return parts.filter(p => !p.ok)
}

export function format(parts: Check[]): string {
  return parts.map(p => (p.ok ? 'ok' : 'fail') + ':' + p.name + ':' + p.detail).join('\\n')
}

export function check() {
  const parts = [checkApp(), checkServer(), checkDb(), checkRoutes()]
  return { ok: parts.every(p => p.ok), app: loadApp().name, port: loadServer().port, parts, failed: failed(parts) }
}

if (import.meta.main) {
  const r = check()
  if (!r.ok) process.exit(1)
}
`],
] as const

for (const [name, body] of scripts) file(`scripts/${name}.ts`, body)

file(
  'test/health.spec.ts',
  `
import { expect, test } from 'bun:test'
import { health, ping } from '../src/routes/health'
import { boot } from '../src/index'

test('health returns ok', () => {
  const res = health()
  expect(res.status).toBe(200)
  expect((res.body as { ok: boolean }).ok).toBe(true)
})

test('ping', () => {
  expect(ping().body).toEqual({ pong: true })
})

test('boot describes the app', () => {
  const { app } = boot()
  expect(app.name).toBe('harbor')
  expect(app.port).toBe(3000)
})

test('live and version', async () => {
  const { live, version } = await import('../src/routes/health')
  expect(live().status).toBe(200)
  expect(version().status).toBe(200)
})

test('ready lists counts', async () => {
  const { ready } = await import('../src/routes/health')
  const { createStore } = await import('../src/lib/store')
  const res = ready(createStore())
  expect(res.status).toBe(200)
  expect((res.body as { ok: boolean }).ok).toBe(true)
})

test('logs and ping stay 200', async () => {
  const { logs, ping: pingRoute } = await import('../src/routes/health')
  expect(logs().status).toBe(200)
  expect(pingRoute().status).toBe(200)
})

test('info returns app and server', async () => {
  const { info } = await import('../src/routes/health')
  expect(info().status).toBe(200)
})
`,
)

file(
  'test/store.spec.ts',
  `
import { expect, test } from 'bun:test'
import { createStore, put, size } from '../src/lib/store'
import { makeUser } from '../src/models/user'
import { makeItem } from '../src/models/item'
import * as items from '../src/services/itemService'

test('store roundtrip', () => {
  const store = createStore()
  const user = put(store.users, makeUser({ email: 'a@b.c', name: 'A' }))
  expect(store.users.get(user.id)?.email).toBe('a@b.c')
  expect(size(store).users).toBe(1)
})

test('item create stores sku as given', () => {
  const store = createStore()
  const item = items.create(store, { sku: 'ABCD1234', name: 'x', price: '1.00' })
  expect(item.sku).toBe('ABCD1234')
  expect(items.get(store, item.id)?.name).toBe('x')
})

test('item update and remove', () => {
  const store = createStore()
  const item = items.create(store, { sku: 'ABCD1234', name: 'x', price: '1.00' })
  items.update(store, item.id, { name: 'y' })
  expect(items.require(store, item.id).name).toBe('y')
  items.remove(store, item.id)
  expect(items.get(store, item.id)).toBeUndefined()
})

test('size starts at zero', () => {
  const counts = size(createStore())
  expect(counts.users).toBe(0)
  expect(counts.orders).toBe(0)
  expect(counts.items).toBe(0)
})

test('user put is retrievable', () => {
  const store = createStore()
  const user = put(store.users, makeUser({ email: 'b@c.d', name: 'B' }))
  expect(store.users.has(user.id)).toBe(true)
  expect(size(store).users).toBe(1)
})
`,
)

file(
  'test/pagination.spec.ts',
  `
import { expect, test } from 'bun:test'
import { slice, parsePage, DEFAULT_LIMIT, hasMore, pagesFor, emptyPage, around } from '../src/lib/pagination'

test('slice pages from zero', () => {
  const rows = [1, 2, 3, 4, 5]
  expect(slice(rows, 1, 2).items).toEqual([1, 2])
  expect(slice(rows, 2, 2).items).toEqual([3, 4])
  expect(slice(rows, 3, 2).items).toEqual([5])
})

test('parsePage falls back', () => {
  expect(parsePage({}).limit).toBe(DEFAULT_LIMIT)
  expect(parsePage({ page: '0', limit: '999' }).page).toBe(1)
})

test('empty list', () => {
  expect(slice([], 1, 10).total).toBe(0)
  expect(slice([], 1, 10).items).toEqual([])
})

test('hasMore and pagesFor', () => {
  const page = slice([1, 2, 3, 4, 5], 1, 2)
  expect(hasMore(page)).toBe(true)
  expect(pagesFor(5, 2)).toBe(3)
  expect(pagesFor(0, 10)).toBe(1)
})

test('emptyPage and around', () => {
  expect(emptyPage().items).toEqual([])
  expect(emptyPage(2, 10).page).toBe(2)
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  expect(around(rows, r => r.id, 'b', 1).map(r => r.id)).toEqual(['a', 'b', 'c'])
  expect(around(rows, r => r.id, 'missing').length).toBe(0)
})

test('slice total matches input length', () => {
  expect(slice([1, 2, 3], 1, 10).total).toBe(3)
  expect(slice([1, 2, 3], 2, 2).items).toEqual([3])
})

test('parsePage default page is 1', () => {
  expect(parsePage({}).page).toBe(1)
})
`,
)

console.log('wrote', root)
