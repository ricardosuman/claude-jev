/**
 * Read-through cache: get() returns the cached value or loads it, sharing one load
 * between concurrent callers. A failed load is not cached.
 */
export class LoadingCache<V> {
  private values = new Map<string, V>()
  private pending = new Map<string, Promise<V>>()

  constructor(private load: (key: string) => Promise<V>) {}

  async get(key: string): Promise<V> {
    if (this.values.has(key)) return this.values.get(key)!
    let promise = this.pending.get(key)
    if (!promise) {
      promise = this.load(key)
        .then(value => {
          this.values.set(key, value)
          return value
        })
        .finally(() => this.pending.delete(key))
      this.pending.set(key, promise)
    }
    return promise
  }

  /** Drops `key` so the next get() loads it again. */
  invalidate(key: string): void {
    this.values.delete(key)
  }
}
