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
  return fnv1a(parts.join('\0'))
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
