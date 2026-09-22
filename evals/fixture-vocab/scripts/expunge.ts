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
