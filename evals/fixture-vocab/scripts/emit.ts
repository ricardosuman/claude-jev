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
