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
  return snapshot().principals.split('\n').length <= 1
}

export function stamp(): string {
  return 'snapshot-' + iso().replaceAll(':', '')
}

if (import.meta.main) snapshot()
