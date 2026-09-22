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
