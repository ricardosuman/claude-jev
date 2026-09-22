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
