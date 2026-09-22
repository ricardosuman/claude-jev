import type { Principal } from '../forms/principal'
import type { Allotment } from '../forms/allotment'
import type { Tribute } from '../forms/tribute'
import type { Docket } from '../forms/docket'
import type { Berth } from '../forms/berth'
import type { Tenure } from '../forms/tenure'
import type { Magazine } from '../forms/magazine'
import type { Indenture } from '../forms/indenture'
import type { Tally } from '../forms/tally'
import type { Bulletin } from '../forms/bulletin'
import type { Tripwire } from '../forms/tripwire'
import type { Holdfast } from '../forms/holdfast'

export type Vault = {
  principals: Map<string, Principal>
  allotments: Map<string, Allotment>
  tributes: Map<string, Tribute>
  dockets: Map<string, Docket>
  berths: Map<string, Berth>
  tenures: Map<string, Tenure>
  magazines: Map<string, Magazine>
  indentures: Map<string, Indenture>
  tallies: Map<string, Tally>
  bulletins: Map<string, Bulletin>
  tripwires: Map<string, Tripwire>
  holdfasts: Map<string, Holdfast>
}

export function createVault(): Vault {
  return {
    principals: new Map(),
    allotments: new Map(),
    tributes: new Map(),
    dockets: new Map(),
    berths: new Map(),
    tenures: new Map(),
    magazines: new Map(),
    indentures: new Map(),
    tallies: new Map(),
    bulletins: new Map(),
    tripwires: new Map(),
    holdfasts: new Map(),
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
    principals: vault.principals.size,
    allotments: vault.allotments.size,
    tributes: vault.tributes.size,
    dockets: vault.dockets.size,
    berths: vault.berths.size,
    tenures: vault.tenures.size,
    magazines: vault.magazines.size,
    indentures: vault.indentures.size,
    tallies: vault.tallies.size,
    bulletins: vault.bulletins.size,
    tripwires: vault.tripwires.size,
    holdfasts: vault.holdfasts.size,
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
