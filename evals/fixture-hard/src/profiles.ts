import { LoadingCache } from './cache'

export type Profile = { id: string; name: string }

export function profileService(db: Map<string, Profile>, delay = (ms: number) => new Promise(r => setTimeout(r, ms))) {
  const cache = new LoadingCache<Profile>(async id => {
    const row = db.get(id)
    await delay(20) // the database round-trip
    if (!row) throw new Error(`no profile ${id}`)
    return { ...row }
  })

  return {
    get: (id: string) => cache.get(id),
    async update(id: string, name: string) {
      await delay(5)
      db.set(id, { id, name })
      cache.invalidate(id)
    },
  }
}
