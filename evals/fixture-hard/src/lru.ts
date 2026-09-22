export type EvictReason = 'capacity' | 'expired' | 'deleted'

type Entry<K, V> = { key: K; value: V; expires: number }

/**
 * Least-recently-used cache with an optional TTL.
 * onEvict fires when an entry leaves the cache for a reason other than being overwritten by set().
 */
export class LruCache<K, V> {
  private entries: Entry<K, V>[] = [] // least recently used first

  constructor(
    private capacity: number,
    private options: { ttlMs?: number; onEvict?: (key: K, value: V, reason: EvictReason) => void; now?: () => number } = {},
  ) {}

  private now() {
    return (this.options.now ?? Date.now)()
  }

  private indexOf(key: K) {
    return this.entries.findIndex(e => e.key === key)
  }

  get(key: K): V | undefined {
    const i = this.indexOf(key)
    if (i < 0) return undefined
    const [entry] = this.entries.splice(i, 1)
    if (entry!.expires <= this.now()) {
      this.options.onEvict?.(entry!.key, entry!.value, 'expired')
      return undefined
    }
    this.entries.push(entry!)
    return entry!.value
  }

  /** The value without marking it as used; an expired entry reads as missing but stays until get() or eviction. */
  peek(key: K): V | undefined {
    const entry = this.entries[this.indexOf(key)]
    return entry && entry.expires > this.now() ? entry.value : undefined
  }

  set(key: K, value: V): void {
    if (this.capacity <= 0) return
    const i = this.indexOf(key)
    if (i >= 0) this.entries.splice(i, 1)
    this.entries.push({ key, value, expires: this.now() + (this.options.ttlMs ?? Infinity) })
    if (this.entries.length > this.capacity) this.dropExpired()
    while (this.entries.length > this.capacity) {
      const oldest = this.entries.shift()!
      this.options.onEvict?.(oldest.key, oldest.value, 'capacity')
    }
  }

  /** Drops every expired entry, earliest expiry first, so expired entries make room before live ones are evicted. */
  private dropExpired() {
    const now = this.now()
    const expired = this.entries.filter(e => e.expires <= now).sort((a, b) => a.expires - b.expires)
    for (const entry of expired) {
      this.entries.splice(this.entries.indexOf(entry), 1)
      this.options.onEvict?.(entry.key, entry.value, 'expired')
    }
  }

  delete(key: K): boolean {
    const i = this.indexOf(key)
    if (i < 0) return false
    const [entry] = this.entries.splice(i, 1)
    this.options.onEvict?.(entry!.key, entry!.value, 'deleted')
    return true
  }

  /** Stored entries, expired ones included until they are evicted. */
  get size(): number {
    return this.entries.length
  }

  /** Live keys, least recently used first. */
  keys(): K[] {
    const now = this.now()
    return this.entries.filter(e => e.expires > now).map(e => e.key)
  }
}
