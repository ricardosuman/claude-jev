// Emits evals/fixture-vocab/. Idempotent overwrite. Run: bun evals/build-fixture-vocab.ts
//
// Ordinary -> codebase dialect (never emit the left column in generated files):
// guest/user -> principal | login -> handshake | logout -> unbind
// cancel -> unwind | retry -> requeue | cache -> scratch
// reservation/booking -> allotment | payment -> tribute | refund -> restitution
// invoice -> docket | room -> berth | check-in -> embark | check-out -> disembark
// session -> tenure | password -> cipher | token -> sigil | email -> bulletin
// discount -> rebate | tax -> levy | price -> tariff | confirm -> countersign
// expire -> lapse | queue -> chute | webhook -> tripwire | cart -> tally
// order -> indenture | inventory -> magazine | register -> indent
// customer -> sojourner | receipt -> quittance | deposit -> earnest
// waitlist -> holdfast | availability -> slack | calendar -> almanac
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = join(import.meta.dir, 'fixture-vocab')
const file = (rel: string, body: string) => {
  const path = join(root, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body.trimStart().replace(/^\n/, '') + (body.endsWith('\n') ? '' : '\n'))
}

file(
  'package.json',
  `{
  "name": "lodge-fixture",
  "private": true,
  "type": "module",
  "scripts": { "test": "bun test" }
}
`,
)

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
  return new AppError(404, what + ' missing')
}

export function clash(message: string): AppError {
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

export function tooMany(message = 'throttled'): AppError {
  return new AppError(429, message)
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export function toBody(err: unknown): { status: number; error: string } {
  if (isAppError(err)) return { status: err.status, error: err.message }
  return { status: 500, error: err instanceof Error ? err.message : 'internal' }
}

export function statusOf(err: unknown): number {
  return isAppError(err) ? err.status : 500
}
`,
)

file(
  'src/lib/http.ts',
  `
export type Result<T = unknown> = { status: number; body: T }

export type Query = Record<string, string | undefined>

export type Plea = { method: string; path: string; query?: Query; body?: unknown; params?: Record<string, string> }

export function json<T>(body: T, status = 200): Result<T> {
  return { status, body }
}

export function noContent(): Result<null> {
  return { status: 204, body: null }
}

export function minted<T>(body: T): Result<T> {
  return { status: 201, body }
}

export function accepted<T>(body: T): Result<T> {
  return { status: 202, body }
}

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

export function plusMin(ms: number, min: number): number {
  return ms + min * 60_000
}

export function plusHours(ms: number, hours: number): number {
  return ms + hours * 3_600_000
}

export function startOfUtcDay(ms: number = now()): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function isLapsed(at: number, ttlMs: number, current: number = now()): boolean {
  return current - at >= ttlMs
}

export function plusDays(ms: number, days: number): number {
  return ms + days * 86_400_000
}

export function minBetween(a: number, b: number): number {
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

export function sigil(bytes = 16): string {
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
  'src/lib/folios.ts',
  `
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
  'src/lib/tariff.ts',
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
  'src/lib/requeue.ts',
  `
export type RequeueOpts = { attempts?: number; waitMs?: number; again?: (err: unknown) => boolean }

export async function requeue<T>(fn: () => Promise<T>, opts: RequeueOpts = {}): Promise<T> {
  const attempts = opts.attempts ?? 3
  const waitMs = opts.waitMs ?? 10
  const again = opts.again ?? (() => true)
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i === attempts - 1 || !again(err)) throw err
      await sleep(waitMs * (i + 1))
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

export function againOnStatus(status: number): boolean {
  return status === 429 || status >= 500
}

export async function requeueOnce<T>(fn: () => Promise<T>): Promise<T> {
  return requeue(fn, { attempts: 2, waitMs: 1 })
}
`,
)

file(
  'src/lib/gates.ts',
  `
import { badRequest } from './errors'

export function assertPresent(value: string | undefined, field: string): string {
  if (value === undefined || value.trim() === '') throw badRequest(field + ' is required')
  return value
}

export function assertAddr(value: string): string {
  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(value)) throw badRequest('invalid addr')
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

type Entity = {
  name: string
  Name: string
  prefix: string
  key: string
  fields: { key: string; type: string; sample: string }[]
}

const entities: Entity[] = [
  { name: 'principal', Name: 'Principal', prefix: 'prn', key: 'principals', fields: [
    { key: 'addr', type: 'string', sample: "'ada@lodge.test'" },
    { key: 'handle', type: 'string', sample: "'Ada'" },
    { key: 'rank', type: 'string', sample: "'member'" },
  ]},
  { name: 'allotment', Name: 'Allotment', prefix: 'alt', key: 'allotments', fields: [
    { key: 'principalId', type: 'string', sample: "'prn_1'" },
    { key: 'berthId', type: 'string', sample: "'brt_1'" },
    { key: 'phase', type: 'string', sample: "'held'" },
    { key: 'blazon', type: 'string', sample: "'ABCDEFGH'" },
    { key: 'unwoundAt', type: 'number | null', sample: 'null' },
  ]},
  { name: 'tribute', Name: 'Tribute', prefix: 'trb', key: 'tributes', fields: [
    { key: 'allotmentId', type: 'string', sample: "'alt_1'" },
    { key: 'minor', type: 'number', sample: '0' },
    { key: 'phase', type: 'string', sample: "'open'" },
  ]},
  { name: 'docket', Name: 'Docket', prefix: 'dck', key: 'dockets', fields: [
    { key: 'principalId', type: 'string', sample: "'prn_1'" },
    { key: 'minor', type: 'number', sample: '0' },
    { key: 'phase', type: 'string', sample: "'open'" },
  ]},
  { name: 'berth', Name: 'Berth', prefix: 'brt', key: 'berths', fields: [
    { key: 'label', type: 'string', sample: "'A1'" },
    { key: 'wing', type: 'string', sample: "'east'" },
    { key: 'tariffMinor', type: 'number', sample: '9000' },
  ]},
  { name: 'tenure', Name: 'Tenure', prefix: 'ten', key: 'tenures', fields: [
    { key: 'principalId', type: 'string', sample: "'prn_1'" },
    { key: 'sigil', type: 'string', sample: "'sig'" },
    { key: 'unboundAt', type: 'number | null', sample: 'null' },
  ]},
  { name: 'magazine', Name: 'Magazine', prefix: 'mag', key: 'magazines', fields: [
    { key: 'berthId', type: 'string', sample: "'brt_1'" },
    { key: 'qty', type: 'number', sample: '0' },
    { key: 'wing', type: 'string', sample: "'east'" },
  ]},
  { name: 'indenture', Name: 'Indenture', prefix: 'ind', key: 'indentures', fields: [
    { key: 'principalId', type: 'string', sample: "'prn_1'" },
    { key: 'phase', type: 'string', sample: "'open'" },
    { key: 'minor', type: 'number', sample: '0' },
  ]},
  { name: 'tally', Name: 'Tally', prefix: 'tal', key: 'tallies', fields: [
    { key: 'principalId', type: 'string', sample: "'prn_1'" },
    { key: 'lines', type: 'number', sample: '0' },
    { key: 'phase', type: 'string', sample: "'open'" },
  ]},
  { name: 'bulletin', Name: 'Bulletin', prefix: 'bul', key: 'bulletins', fields: [
    { key: 'addr', type: 'string', sample: "'ops@lodge.test'" },
    { key: 'subject', type: 'string', sample: "'digest'" },
    { key: 'body', type: 'string', sample: "''" },
  ]},
  { name: 'tripwire', Name: 'Tripwire', prefix: 'trp', key: 'tripwires', fields: [
    { key: 'url', type: 'string', sample: "'https://example.test/hook'" },
    { key: 'event', type: 'string', sample: "'tribute.taken'" },
    { key: 'secret', type: 'string', sample: "'s'" },
  ]},
  { name: 'holdfast', Name: 'Holdfast', prefix: 'hld', key: 'holdfasts', fields: [
    { key: 'principalId', type: 'string', sample: "'prn_1'" },
    { key: 'berthId', type: 'string', sample: "'brt_1'" },
    { key: 'phase', type: 'string', sample: "'waiting'" },
  ]},
]

const typeFields = (e: Entity) => e.fields.map(f => `  ${f.key}: ${f.type}`).join('\n')
const inputFields = (e: Entity) => e.fields.map(f => `  ${f.key}?: ${f.type}`).join('\n')
const assignFields = (e: Entity) => e.fields.map(f => `    ${f.key}: input.${f.key} ?? ${f.sample},`).join('\n')
const patchFields = (e: Entity) => e.fields.map(f => `  if (patch.${f.key} !== undefined) next.${f.key} = patch.${f.key}`).join('\n')

for (const e of entities) {
  const extra =
    e.name === 'allotment'
      ? `
export function isUnwound(row: Allotment): boolean {
  return row.unwoundAt !== null
}
`
      : ''
  file(
    `src/forms/${e.name}.ts`,
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

export function clone${e.Name}(row: ${e.Name}): ${e.Name} {
  return { ...row }
}

export function idsOf${e.Name}s(rows: ${e.Name}[]): string[] {
  return rows.map(row => row.id)
}

export function blank${e.Name}Input(): ${e.Name}Input {
  return {}
}

export function hasId(row: ${e.Name}, id: string): boolean {
  return row.id === id
}

export function ageMs(row: ${e.Name}, at: number = now()): number {
  return Math.max(0, at - row.createdAt)
}
${extra}`,
  )
}

const vaultImports = entities.map(e => `import type { ${e.Name} } from '../forms/${e.name}'`).join('\n')
const vaultFields = entities.map(e => `  ${e.key}: Map<string, ${e.Name}>`).join('\n')
const vaultInit = entities.map(e => `    ${e.key}: new Map(),`).join('\n')
const vaultSize = entities.map(e => `    ${e.key}: vault.${e.key}.size,`).join('\n')

file(
  'src/lib/vault.ts',
  `
${vaultImports}

export type Vault = {
${vaultFields}
}

export function createVault(): Vault {
  return {
${vaultInit}
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

export function size(vault: Vault): Record<string, number> {
  return {
${vaultSize}
  }
}

export function clear(vault: Vault): void {
  for (const map of Object.values(vault)) map.clear()
}

export function has(map: Map<string, unknown>, id: string): boolean {
  return map.has(id)
}

export function take<T>(map: Map<string, T>, id: string): T | undefined {
  const row = map.get(id)
  if (row) map.delete(id)
  return row
}
`,
)

for (const e of entities) {
  const extra =
    e.name === 'allotment'
      ? `
export function mint(vault: Vault, input: ${e.Name}Input): ${e.Name} {
  assertPresent(input.principalId, 'principalId')
  assertPresent(input.berthId, 'berthId')
  const blazon = input.blazon && input.blazon.length > 0 ? input.blazon : 'ABCDEFGH'
  const row = make${e.Name}({ ...input, phase: input.phase ?? 'held', blazon, unwoundAt: null })
  return put(vault.${e.key}, row)
}

export function unwind(vault: Vault, id: string): ${e.Name} {
  const row = get(vault, id)
  if (!row) throw notFound('${e.name}')
  return put(vault.${e.key}, touch${e.Name}(row, { phase: 'unwound', unwoundAt: now() }))
}
`
      : e.name === 'tenure'
        ? `
export function mint(vault: Vault, input: ${e.Name}Input): ${e.Name} {
  assertPresent(input.principalId, 'principalId')
  const row = make${e.Name}({ ...input, sigil: input.sigil ?? sigil(20), unboundAt: null })
  return put(vault.${e.key}, row)
}

export function unbind(vault: Vault, id: string): ${e.Name} {
  const row = get(vault, id)
  if (!row) throw notFound('${e.name}')
  return put(vault.${e.key}, touch${e.Name}(row, { unboundAt: now() }))
}
`
        : e.name === 'principal'
          ? `
export function mint(vault: Vault, input: ${e.Name}Input): ${e.Name} {
  assertPresent(input.addr, 'addr')
  assertPresent(input.handle, 'handle')
  const row = make${e.Name}(input)
  return put(vault.${e.key}, row)
}
`
          : `
export function mint(vault: Vault, input: ${e.Name}Input): ${e.Name} {
  const row = make${e.Name}(input)
  return put(vault.${e.key}, row)
}
`

  const imports =
    (e.name === 'tenure' ? `import { sigil } from '../lib/ids'\n` : '') +
    (e.name === 'tenure' || e.name === 'allotment' ? `import { now } from '../lib/clock'\n` : '') +
    (e.name === 'principal' || e.name === 'tenure' || e.name === 'allotment'
      ? `import { assertPresent } from '../lib/gates'\n`
      : '')

  const tributeConst = e.name === 'tribute' ? `\nexport const TRIBUTE_BATCH = 40\n` : ''

  file(
    `src/stewards/${e.name}.ts`,
    `
import type { Vault } from '../lib/vault'
import { all, put } from '../lib/vault'
import { make${e.Name}, sort${e.Name}s, touch${e.Name}, type ${e.Name}, type ${e.Name}Input } from '../forms/${e.name}'
import { notFound } from '../lib/errors'
import { slice, parseFolio, type Folio } from '../lib/folios'
import { info } from '../lib/logger'
${imports}${tributeConst}
export function roster(vault: Vault, query: { folio?: string; span?: string } = {}): Folio<${e.Name}> {
  const { folio, span } = parseFolio(query)
  return slice(sort${e.Name}s(all(vault.${e.key})), folio, span)
}

export function get(vault: Vault, id: string): ${e.Name} | undefined {
  return vault.${e.key}.get(id)
}

export function require(vault: Vault, id: string): ${e.Name} {
  const row = get(vault, id)
  if (!row) throw notFound('${e.name}')
  return row
}

${extra}
export function revise(vault: Vault, id: string, patch: ${e.Name}Input): ${e.Name} {
  const row = require(vault, id)
  const next = touch${e.Name}(row, patch)
  info('${e.name}.revise', { id })
  return put(vault.${e.key}, next)
}

export function expunge(vault: Vault, id: string): void {
  if (!vault.${e.key}.delete(id)) throw notFound('${e.name}')
}

export function count(vault: Vault): number {
  return vault.${e.key}.size
}

export function sieve(vault: Vault, pred: (row: ${e.Name}) => boolean): ${e.Name}[] {
  return all(vault.${e.key}).filter(pred)
}
`,
  )
}

file(
  'src/stewards/herald.ts',
  `
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
`,
)

file(
  'src/ingress/pulse.ts',
  `
import { json, type Result } from '../lib/http'
import { size, type Vault } from '../lib/vault'
import { iso, now } from '../lib/clock'
import { recent } from '../lib/logger'
import { loadApp } from '../../config/app'
import { loadLodge } from '../../config/lodge'

export function pulse(): Result {
  const app = loadApp()
  return json({ ok: true, name: app.name, env: app.env, at: iso() })
}

export function ready(vault: Vault): Result {
  return json({ ok: true, counts: size(vault) })
}

export function live(): Result {
  return json({ ok: true, uptimeHint: now() })
}

export function version(): Result {
  const lodge = loadLodge()
  return json({ host: lodge.host, port: lodge.port })
}

export function logs(): Result {
  return json({ events: recent(20) })
}

export function ping(): Result {
  return json({ pong: true })
}

export function info(): Result {
  return json({ app: loadApp(), lodge: loadLodge() })
}

export function counts(vault: Vault): Result {
  const c = size(vault)
  return json({ total: Object.values(c).reduce((a, b) => a + b, 0), c })
}

export function recentErrors(): Result {
  return json({ events: recent(50).filter(e => e.level === 'error' || e.level === 'warn') })
}
`,
)

for (const e of entities) {
  const extra =
    e.name === 'allotment'
      ? `
export function unwind(vault: Vault, id: string): Result {
  const row = allotments.get(vault, id)
  if (!row) throw notFound('allotment')
  if (row.unwoundAt) throw clash('allotment is unwound')
  return json(allotments.unwind(vault, id))
}

export function touch(vault: Vault, id: string): Result {
  const row = allotments.require(vault, id)
  return json(row)
}
`
      : e.name === 'tenure'
        ? `
export function unbind(vault: Vault, id: string): Result {
  const row = tenures.get(vault, id)
  if (!row) throw notFound('tenure')
  if (row.unboundAt) throw clash('tenure is unbound')
  return json(tenures.unbind(vault, id))
}
`
        : ''

  file(
    `src/ingress/${e.key}.ts`,
    `
import { json, minted, noContent, type Query, type Result } from '../lib/http'
import { notFound, clash } from '../lib/errors'
import type { Vault } from '../lib/vault'
import * as ${e.key} from '../stewards/${e.name}'
import type { ${e.Name}Input } from '../forms/${e.name}'

export function roster(vault: Vault, query: Query = {}): Result {
  return json(${e.key}.roster(vault, query))
}

export function get(vault: Vault, id: string): Result {
  const row = ${e.key}.get(vault, id)
  if (!row) throw notFound('${e.name}')
  return json(row)
}

export function mint(vault: Vault, input: ${e.Name}Input): Result {
  return minted(${e.key}.mint(vault, input))
}

export function revise(vault: Vault, id: string, input: ${e.Name}Input): Result {
  return json(${e.key}.revise(vault, id, input))
}

export function expunge(vault: Vault, id: string): Result {
  ${e.key}.expunge(vault, id)
  return noContent()
}

export function count(vault: Vault): Result {
  return json({ count: ${e.key}.count(vault) })
}

export function exists(vault: Vault, id: string): Result {
  return json({ exists: ${e.key}.get(vault, id) !== undefined })
}

export function require(vault: Vault, id: string): Result {
  return json(${e.key}.require(vault, id))
}

export function forage(vault: Vault, query: Query): Result {
  const q = (query.q ?? '').toLowerCase()
  const rows = ${e.key}.sieve(vault, row => JSON.stringify(row).toLowerCase().includes(q))
  return json({ items: rows, total: rows.length })
}

export function ids(vault: Vault): Result {
  return json(${e.key}.roster(vault, { folio: '1', span: '100' }).items.map(row => row.id))
}
${extra}`,
  )
}

type Setting = { key: string; env: string; def: string; num?: boolean; bool?: boolean }

const configs: { file: string; load: string; typeName: string; settings: Setting[]; extra: string }[] = [
  { file: 'app', load: 'loadApp', typeName: 'AppConfig', settings: [
    { key: 'name', env: 'APP_NAME', def: "'lodge'" },
    { key: 'env', env: 'APP_ENV', def: "'test'" },
    { key: 'logLevel', env: 'LOG_LEVEL', def: "'info'" },
    { key: 'release', env: 'RELEASE', def: "'dev'" },
  ], extra: "export const APP_ID = 'lodge-api'\n" },
  { file: 'lodge', load: 'loadLodge', typeName: 'LodgeConfig', settings: [
    { key: 'host', env: 'HOST', def: "'127.0.0.1'" },
    { key: 'port', env: 'PORT', def: '3000', num: true },
    { key: 'idleSec', env: 'IDLE_SEC', def: '65', num: true },
    { key: 'trustProxy', env: 'TRUST_PROXY', def: 'false', bool: true },
  ], extra: 'export const FALLBACK_PORT = 3000\n' },
  { file: 'ledger', load: 'loadLedger', typeName: 'LedgerConfig', settings: [
    { key: 'url', env: 'LEDGER_URL', def: "'memory://lodge'" },
    { key: 'pool', env: 'LEDGER_POOL', def: '5', num: true },
    { key: 'slowMs', env: 'LEDGER_SLOW_MS', def: '200', num: true },
    { key: 'ssl', env: 'LEDGER_SSL', def: 'false', bool: true },
  ], extra: "export const SHIFT_TABLE = 'schema_shifts'\n" },
  { file: 'scratch', load: 'loadScratch', typeName: 'ScratchConfig', settings: [
    { key: 'url', env: 'SCRATCH_URL', def: "'memory://scratch'" },
    { key: 'ttlSec', env: 'SCRATCH_TTL_SEC', def: '60', num: true },
    { key: 'prefix', env: 'SCRATCH_PREFIX', def: "'ldg'" },
    { key: 'windowSec', env: 'SCRATCH_WINDOW_SEC', def: '15', num: true },
  ], extra: 'export const SCRATCH_NULL_TTL_SEC = 5\n' },
  { file: 'bulletin', load: 'loadBulletin', typeName: 'BulletinConfig', settings: [
    { key: 'from', env: 'BULLETIN_FROM', def: "'ops@lodge.test'" },
    { key: 'host', env: 'BULLETIN_HOST', def: "'localhost'" },
    { key: 'port', env: 'BULLETIN_PORT', def: '1025', num: true },
    { key: 'requeueWindowSec', env: 'BULLETIN_REQUEUE_WINDOW_SEC', def: '15', num: true },
  ], extra: 'export const BULLETIN_BATCH = 25\n' },
  { file: 'allotment', load: 'loadAllotment', typeName: 'AllotmentConfig', settings: [
    { key: 'unwindDwellMin', env: 'UNWIND_DWELL_MIN', def: '73', num: true },
    { key: 'holdMin', env: 'ALLOTMENT_HOLD_MIN', def: '20', num: true },
    { key: 'lapseDays', env: 'ALLOTMENT_LAPSE_DAYS', def: '5', num: true },
    { key: 'countersignDay', env: 'ALLOTMENT_COUNTERSIGN_DAY', def: '1', num: true },
  ], extra: `export const ALLOTMENT_CAP = 10_000

export function unwindDwell(cfg: AllotmentConfig): number {
  return cfg.unwindDwellMin
}
` },
  { file: 'tribute', load: 'loadTribute', typeName: 'TributeConfig', settings: [
    { key: 'currency', env: 'TRIBUTE_CURRENCY', def: "'USD'" },
    { key: 'graceDays', env: 'TRIBUTE_GRACE_DAYS', def: '5', num: true },
    { key: 'captureHoldMin', env: 'TRIBUTE_CAPTURE_HOLD_MIN', def: '20', num: true },
    { key: 'statementDay', env: 'TRIBUTE_STATEMENT_DAY', def: '1', num: true },
  ], extra: 'export const TRIBUTE_MINOR_DIGITS = 2\n' },
  { file: 'flags', load: 'loadFlags', typeName: 'FlagsConfig', settings: [
    { key: 'newEmbark', env: 'FLAG_NEW_EMBARK', def: 'false', bool: true },
    { key: 'auditVerbose', env: 'FLAG_AUDIT_VERBOSE', def: 'true', bool: true },
    { key: 'allotmentsV2', env: 'FLAG_ALLOTMENTS_V2', def: 'false', bool: true },
    { key: 'windowPreview', env: 'FLAG_WINDOW_PREVIEW', def: 'false', bool: true },
  ], extra: "export const FLAG_SOURCE = 'env'\n" },
  { file: 'caps', load: 'loadCaps', typeName: 'CapsConfig', settings: [
    { key: 'berthFolioSize', env: 'BERTH_FOLIO_SIZE', def: '20', num: true },
    { key: 'uploadMb', env: 'UPLOAD_MB', def: '8', num: true },
    { key: 'bulletinMax', env: 'BULLETIN_MAX', def: '4000', num: true },
    { key: 'windowItems', env: 'CAP_WINDOW_ITEMS', def: '500', num: true },
  ], extra: 'export const HARD_BERTH_CAP = 10_000\n' },
  { file: 'regions', load: 'loadRegions', typeName: 'RegionsConfig', settings: [
    { key: 'home', env: 'REGION_HOME', def: "'us-east'" },
    { key: 'failover', env: 'REGION_FAILOVER', def: "'us-west'" },
    { key: 'windowTz', env: 'REGION_WINDOW_TZ', def: "'UTC'" },
    { key: 'strict', env: 'REGION_STRICT', def: 'false', bool: true },
  ], extra: "export const KNOWN_REGIONS = ['us-east', 'us-west', 'eu-west'] as const\n" },
  { file: 'chute', load: 'loadChute', typeName: 'ChuteConfig', settings: [
    { key: 'url', env: 'CHUTE_URL', def: "'memory://chute'" },
    { key: 'visibilitySec', env: 'CHUTE_VISIBILITY_SEC', def: '30', num: true },
    { key: 'windowSec', env: 'CHUTE_WINDOW_SEC', def: '12', num: true },
    { key: 'workers', env: 'CHUTE_WORKERS', def: '2', num: true },
  ], extra: "export const CHUTE_NAMES = ['bulletin', 'tripwires', 'dockets'] as const\n" },
  { file: 'bins', load: 'loadBins', typeName: 'BinsConfig', settings: [
    { key: 'bucket', env: 'BINS_BUCKET', def: "'lodge-local'" },
    { key: 'region', env: 'BINS_REGION', def: "'local'" },
    { key: 'prefix', env: 'BINS_PREFIX', def: "'dev/'" },
    { key: 'windowSec', env: 'BINS_SIGNED_WINDOW_SEC', def: '90', num: true },
  ], extra: 'export const BINS_MAX_KEYS = 1000\n' },
]

function readSetting(s: Setting): string {
  if (s.num) return `Number(env.${s.env} ?? ${s.def})`
  if (s.bool) return `env.${s.env} === '1' || env.${s.env} === 'true' ? true : env.${s.env} === '0' || env.${s.env} === 'false' ? false : ${s.def}`
  return `env.${s.env} ?? ${s.def}`
}

for (const c of configs) {
  const fields = c.settings.map(s => `  ${s.key}: ${s.num ? 'number' : s.bool ? 'boolean' : 'string'}`).join('\n')
  const assigns = c.settings.map(s => `    ${s.key}: ${readSetting(s)},`).join('\n')
  const docs = c.settings.map(s => ` * ${s.env} — ${s.key} (${s.def})`).join('\n')
  file(
    `config/${c.file}.ts`,
    `
export type ${c.typeName} = {
${fields}
}

${c.extra}
/**
 * Keys:
${docs}
 */
export function ${c.load}(env: Record<string, string | undefined> = process.env): ${c.typeName} {
  return {
${assigns}
  }
}

export function freeze${c.typeName}(cfg: ${c.typeName}): Readonly<${c.typeName}> {
  return Object.freeze({ ...cfg })
}

export function describe${c.typeName}(cfg: ${c.typeName}): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function merge${c.typeName}(base: ${c.typeName}, patch: Partial<${c.typeName}>): ${c.typeName} {
  return { ...base, ...patch }
}

export function pick${c.typeName}<K extends keyof ${c.typeName}>(cfg: ${c.typeName}, keys: K[]): Pick<${c.typeName}, K> {
  const out = {} as Pick<${c.typeName}, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
`,
  )
}

const ingressImports = entities.map(e => `import * as ${e.key} from './ingress/${e.key}'`).join('\n')
const matchGets = entities
  .map(e => `  if (method === 'GET' && path === '/${e.key}') return ${e.key}.roster(vault, query)`)
  .join('\n')

file(
  'src/app.ts',
  `
import type { Vault } from './lib/vault'
import { isAppError, toBody } from './lib/errors'
import { json, type Query, type Result } from './lib/http'
import * as pulse from './ingress/pulse'
${ingressImports}
import { loadApp } from '../config/app'
import { loadLodge } from '../config/lodge'
import { info } from './lib/logger'

export type { Plea } from './lib/http'
import type { Plea } from './lib/http'

export function describeApp(): { name: string; port: number } {
  return { name: loadApp().name, port: loadLodge().port }
}

export function dispatch(vault: Vault, plea: Plea): Result {
  try {
    info('http', { method: plea.method, path: plea.path })
    const result = match(vault, plea)
    return result ?? json({ error: 'missing' }, 404)
  } catch (err) {
    if (isAppError(err)) return json({ error: err.message }, err.status)
    const body = toBody(err)
    return json({ error: body.error }, body.status)
  }
}

function match(vault: Vault, plea: Plea): Result | undefined {
  const { method, path } = plea
  const query = plea.query ?? {}
  const params = plea.params ?? {}
  const body = (plea.body ?? {}) as Record<string, unknown>
  if (method === 'GET' && path === '/health') return pulse.pulse()
  if (method === 'GET' && path === '/ready') return pulse.ready(vault)
  if (method === 'POST' && path === '/allotments') return allotments.mint(vault, body)
  if (method === 'POST' && path.startsWith('/allotments/') && path.endsWith('/unwind')) {
    return allotments.unwind(vault, params.id ?? path.split('/')[2]!)
  }
  if (method === 'POST' && path === '/principals') return principals.mint(vault, body)
  if (method === 'POST' && path === '/tenures') return tenures.mint(vault, body)
  if (method === 'POST' && path.startsWith('/tenures/') && path.endsWith('/unbind')) {
    return tenures.unbind(vault, params.id ?? path.split('/')[2]!)
  }
${matchGets}
  return undefined
}
`,
)

file(
  'src/index.ts',
  `
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
`,
)

file(
  'scripts/sow.ts',
  `
import { createVault, put, size, type Vault } from '../src/lib/vault'
import { makePrincipal } from '../src/forms/principal'
import { makeBerth } from '../src/forms/berth'
import { makeAllotment } from '../src/forms/allotment'
import { makeIndenture } from '../src/forms/indenture'
import { makeBulletin } from '../src/forms/bulletin'
import { makeHoldfast } from '../src/forms/holdfast'
import { info } from '../src/lib/logger'

const LABELS = ['A1', 'A2', 'B1', 'B2']

export function sowPrincipal(vault: Vault, addr: string, handle: string, rank = 'member') {
  return put(vault.principals, makePrincipal({ addr, handle, rank }))
}

export function sowBerth(vault: Vault, label: string, wing = 'east', tariffMinor = 9000) {
  return put(vault.berths, makeBerth({ label, wing, tariffMinor }))
}

export function sowAllotment(vault: Vault, principalId: string, berthId: string) {
  return put(vault.allotments, makeAllotment({ principalId, berthId, phase: 'held', blazon: 'ABCDEFGH' }))
}

export function sowIndenture(vault: Vault, principalId: string, minor = 900) {
  return put(vault.indentures, makeIndenture({ principalId, phase: 'open', minor }))
}

export function sowBulletin(vault: Vault, addr: string, subject: string) {
  return put(vault.bulletins, makeBulletin({ addr, subject }))
}

export function sowHoldfast(vault: Vault, principalId: string, berthId: string) {
  return put(vault.holdfasts, makeHoldfast({ principalId, berthId, phase: 'waiting' }))
}

export function labels(): string[] {
  return [...LABELS]
}

export function sow() {
  const vault = createVault()
  const principal = sowPrincipal(vault, 'ada@lodge.test', 'Ada', 'admin')
  sowPrincipal(vault, 'al@lodge.test', 'Al')
  const berths = LABELS.map(label => sowBerth(vault, label))
  sowAllotment(vault, principal.id, berths[0]!.id)
  sowIndenture(vault, principal.id)
  sowBulletin(vault, principal.addr, 'digest')
  sowHoldfast(vault, principal.id, berths[1]!.id)
  info('sow', size(vault))
  return vault
}

if (import.meta.main) sow()
`,
)

file(
  'scripts/shift.ts',
  `
import { loadLedger } from '../config/ledger'
import { info, warn } from '../src/lib/logger'

export const STEPS = ['init', 'principals', 'allotments', 'berths', 'tributes', 'dockets'] as const

export type Step = (typeof STEPS)[number]

export function indexOf(step: Step): number {
  return STEPS.indexOf(step)
}

export function shift(to: Step = STEPS[STEPS.length - 1]!) {
  const ledger = loadLedger()
  const applied: Step[] = []
  for (const step of STEPS) {
    applied.push(step)
    info('shift', { step, url: ledger.url, pool: ledger.pool })
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
  const ledger = loadLedger()
  if (!ledger.url) warn('shift.noledger', {})
  return shift(to)
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

if (import.meta.main) shift()
`,
)

file(
  'scripts/snapshot.ts',
  `
import { createVault, all, size, type Vault } from '../src/lib/vault'
import { table } from '../src/lib/csv'
import { info } from '../src/lib/logger'
import { iso } from '../src/lib/clock'

export function dumpPrincipals(vault: Vault): string {
  return table(['id', 'addr', 'rank'], all(vault.principals).map(p => [p.id, p.addr, p.rank]))
}

export function dumpAllotments(vault: Vault): string {
  return table(['id', 'principalId', 'phase', 'blazon'], all(vault.allotments).map(a => [a.id, a.principalId, a.phase, a.blazon]))
}

export function dumpBerths(vault: Vault): string {
  return table(['id', 'label', 'wing'], all(vault.berths).map(b => [b.id, b.label, b.wing]))
}

export function dumpBulletins(vault: Vault): string {
  return table(['id', 'addr', 'subject'], all(vault.bulletins).map(b => [b.id, b.addr, b.subject]))
}

export function dumpHoldfasts(vault: Vault): string {
  return table(['id', 'principalId', 'phase'], all(vault.holdfasts).map(h => [h.id, h.principalId, h.phase]))
}

export function snapshot(vault = createVault()) {
  const payload = {
    at: iso(),
    principals: dumpPrincipals(vault),
    allotments: dumpAllotments(vault),
    berths: dumpBerths(vault),
    bulletins: dumpBulletins(vault),
    holdfasts: dumpHoldfasts(vault),
  }
  info('snapshot', size(vault))
  return payload
}

export function empty(): boolean {
  return snapshot().principals.split('\\n').length <= 1
}

export function stamp(): string {
  return 'snapshot-' + iso().replaceAll(':', '')
}

if (import.meta.main) snapshot()
`,
)

file(
  'scripts/expunge.ts',
  `
import { createVault, all, type Vault } from '../src/lib/vault'
import { now, plusHours } from '../src/lib/clock'
import { info } from '../src/lib/logger'

export function expungeTenures(vault: Vault, cutoff: number): number {
  let n = 0
  for (const row of all(vault.tenures)) {
    if (row.unboundAt && row.unboundAt < cutoff) {
      vault.tenures.delete(row.id)
      n++
    }
  }
  return n
}

export function expungeBulletins(vault: Vault, cutoff: number): number {
  let n = 0
  for (const row of all(vault.bulletins)) {
    if (row.createdAt < cutoff) {
      vault.bulletins.delete(row.id)
      n++
    }
  }
  return n
}

export function expungeHoldfasts(vault: Vault, cutoff: number): number {
  let n = 0
  for (const row of all(vault.holdfasts)) {
    if (row.createdAt < cutoff && row.phase === 'waiting') {
      vault.holdfasts.delete(row.id)
      n++
    }
  }
  return n
}

export function cutoffFromHours(olderThanHours: number): number {
  return plusHours(now(), -olderThanHours)
}

export function expunge(vault = createVault(), olderThanHours = 24) {
  const cutoff = cutoffFromHours(olderThanHours)
  const tenures = expungeTenures(vault, cutoff)
  const bulletins = expungeBulletins(vault, cutoff)
  const holdfasts = expungeHoldfasts(vault, cutoff)
  info('expunge', { tenures, bulletins, holdfasts, olderThanHours })
  return tenures + bulletins + holdfasts
}

if (import.meta.main) expunge()
`,
)

file(
  'scripts/emit.ts',
  `
import { createVault, all, type Vault } from '../src/lib/vault'
import { table } from '../src/lib/csv'
import { loadBins } from '../config/bins'
import { loadCaps } from '../config/caps'
import { info } from '../src/lib/logger'

export function berthsCsv(vault: Vault): string {
  return table(['id', 'label', 'wing', 'tariffMinor'], all(vault.berths).map(b => [b.id, b.label, b.wing, b.tariffMinor]))
}

export function allotmentsCsv(vault: Vault): string {
  return table(['id', 'blazon', 'phase'], all(vault.allotments).map(a => [a.id, a.blazon, a.phase]))
}

export function principalsCsv(vault: Vault): string {
  return table(['id', 'addr', 'handle'], all(vault.principals).map(p => [p.id, p.addr, p.handle]))
}

export function tributesCsv(vault: Vault): string {
  return table(['id', 'allotmentId', 'minor'], all(vault.tributes).map(t => [t.id, t.allotmentId, t.minor]))
}

export function emit(vault = createVault()) {
  const bins = loadBins()
  const caps = loadCaps()
  const payload = {
    bucket: bins.bucket,
    cap: caps.berthFolioSize,
    berths: berthsCsv(vault),
    allotments: allotmentsCsv(vault),
    principals: principalsCsv(vault),
    tributes: tributesCsv(vault),
  }
  info('emit', { bucket: bins.bucket })
  return payload
}

export function dest(): string {
  return loadBins().prefix + 'emit.csv'
}

if (import.meta.main) emit()
`,
)

file(
  'scripts/pulse.ts',
  `
import { loadLodge } from '../config/lodge'
import { loadApp } from '../config/app'
import { loadLedger } from '../config/ledger'
import { pulse, ping } from '../src/ingress/pulse'

export type Check = { ok: boolean; name: string; detail: string }

export function checkApp(): Check {
  const app = loadApp()
  return { ok: !!app.name, name: 'app', detail: app.env }
}

export function checkLodge(): Check {
  const lodge = loadLodge()
  return { ok: lodge.port > 0, name: 'lodge', detail: lodge.host + ':' + lodge.port }
}

export function checkLedger(): Check {
  const ledger = loadLedger()
  return { ok: ledger.url.length > 0, name: 'ledger', detail: ledger.url }
}

export function checkIngress(): Check {
  const res = pulse()
  const pong = ping()
  return { ok: res.status === 200 && pong.status === 200, name: 'ingress', detail: String(res.status) }
}

export function missed(parts: Check[]): Check[] {
  return parts.filter(p => !p.ok)
}

export function format(parts: Check[]): string {
  return parts.map(p => (p.ok ? 'ok' : 'miss') + ':' + p.name + ':' + p.detail).join('\\n')
}

export function check() {
  const parts = [checkApp(), checkLodge(), checkLedger(), checkIngress()]
  return { ok: parts.every(p => p.ok), app: loadApp().name, port: loadLodge().port, parts, missed: missed(parts) }
}

if (import.meta.main) {
  const r = check()
  if (!r.ok) process.exit(1)
}
`,
)

file(
  'test/pulse.spec.ts',
  `
import { expect, test } from 'bun:test'
import { pulse, ping } from '../src/ingress/pulse'
import { boot } from '../src/index'

test('pulse is ok', () => {
  const res = pulse()
  expect(res.status).toBe(200)
  expect((res.body as { ok: boolean }).ok).toBe(true)
})

test('ping', () => {
  expect(ping().body).toEqual({ pong: true })
})

test('boot describes the app', () => {
  const { app } = boot()
  expect(app.name).toBe('lodge')
  expect(app.port).toBe(3000)
})

test('live and version', async () => {
  const { live, version } = await import('../src/ingress/pulse')
  expect(live().status).toBe(200)
  expect(version().status).toBe(200)
})

test('ready lists counts', async () => {
  const { ready } = await import('../src/ingress/pulse')
  const { createVault } = await import('../src/lib/vault')
  const res = ready(createVault())
  expect(res.status).toBe(200)
  expect((res.body as { ok: boolean }).ok).toBe(true)
})

test('logs and ping stay 200', async () => {
  const { logs, ping: pingRoute } = await import('../src/ingress/pulse')
  expect(logs().status).toBe(200)
  expect(pingRoute().status).toBe(200)
})

test('info returns app and lodge', async () => {
  const { info } = await import('../src/ingress/pulse')
  expect(info().status).toBe(200)
})
`,
)

file(
  'test/folios.spec.ts',
  `
import { expect, test } from 'bun:test'
import { slice, parseFolio, FALLBACK_SPAN, hasMore, foliosFor, emptyFolio, around } from '../src/lib/folios'

test('slice folios from zero', () => {
  const rows = [1, 2, 3, 4, 5]
  expect(slice(rows, 1, 2).items).toEqual([1, 2])
  expect(slice(rows, 2, 2).items).toEqual([3, 4])
  expect(slice(rows, 3, 2).items).toEqual([5])
})

test('parseFolio falls back', () => {
  expect(parseFolio({}).span).toBe(FALLBACK_SPAN)
  expect(parseFolio({ folio: '0', span: '999' }).folio).toBe(1)
})

test('empty list', () => {
  expect(slice([], 1, 10).total).toBe(0)
  expect(slice([], 1, 10).items).toEqual([])
})

test('hasMore and foliosFor', () => {
  const folio = slice([1, 2, 3, 4, 5], 1, 2)
  expect(hasMore(folio)).toBe(true)
  expect(foliosFor(5, 2)).toBe(3)
  expect(foliosFor(0, 10)).toBe(1)
})

test('emptyFolio and around', () => {
  expect(emptyFolio().items).toEqual([])
  expect(emptyFolio(2, 10).folio).toBe(2)
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  expect(around(rows, r => r.id, 'b', 1).map(r => r.id)).toEqual(['a', 'b', 'c'])
  expect(around(rows, r => r.id, 'missing').length).toBe(0)
})

test('slice total matches input length', () => {
  expect(slice([1, 2, 3], 1, 10).total).toBe(3)
  expect(slice([1, 2, 3], 2, 2).items).toEqual([3])
})

test('parseFolio starts at 1', () => {
  expect(parseFolio({}).folio).toBe(1)
})
`,
)

file(
  'test/vault.spec.ts',
  `
import { expect, test } from 'bun:test'
import { createVault, put, size } from '../src/lib/vault'
import { makePrincipal } from '../src/forms/principal'
import { makeAllotment } from '../src/forms/allotment'
import * as allotments from '../src/stewards/allotment'

test('vault roundtrip', () => {
  const vault = createVault()
  const principal = put(vault.principals, makePrincipal({ addr: 'a@b.c', handle: 'A' }))
  expect(vault.principals.get(principal.id)?.addr).toBe('a@b.c')
  expect(size(vault).principals).toBe(1)
})

test('allotment mint keeps blazon as given', () => {
  const vault = createVault()
  const row = allotments.mint(vault, { principalId: 'prn_1', berthId: 'brt_1', blazon: 'ABCDEFGH' })
  expect(row.blazon).toBe('ABCDEFGH')
  expect(allotments.get(vault, row.id)?.berthId).toBe('brt_1')
})

test('allotment revise and expunge', () => {
  const vault = createVault()
  const row = allotments.mint(vault, { principalId: 'prn_1', berthId: 'brt_1', blazon: 'ABCDEFGH' })
  allotments.revise(vault, row.id, { phase: 'countersigned' })
  expect(allotments.require(vault, row.id).phase).toBe('countersigned')
  allotments.expunge(vault, row.id)
  expect(allotments.get(vault, row.id)).toBeUndefined()
})

test('size starts at zero', () => {
  const counts = size(createVault())
  expect(counts.principals).toBe(0)
  expect(counts.allotments).toBe(0)
  expect(counts.berths).toBe(0)
})

test('principal put is retrievable', () => {
  const vault = createVault()
  const principal = put(vault.principals, makePrincipal({ addr: 'b@c.d', handle: 'B' }))
  expect(vault.principals.has(principal.id)).toBe(true)
  expect(size(vault).principals).toBe(1)
})

test('makeAllotment fills blazon', () => {
  const row = makeAllotment({ principalId: 'prn_1', berthId: 'brt_1' })
  expect(row.blazon).toBe('ABCDEFGH')
  expect(row.unwoundAt).toBeNull()
})
`,
)
