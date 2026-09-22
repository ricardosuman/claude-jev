import { createVault, put, size, type Vault } from '../src/lib/vault'
import { makePrincipal } from '../src/forms/principal'
import { makeBerth } from '../src/forms/berth'
import { makeAllotment } from '../src/forms/allotment'
import { makeIndenture } from '../src/forms/indenture'
import { makeBulletin } from '../src/forms/bulletin'
import { makeHoldfast } from '../src/forms/holdfast'
import { info } from '../src/lib/logger'

const LABELS = ['A1', 'A2', 'B1', 'B2']

export function sowPrincipal(vault: Vault, addr: string, handle: string, rank = 'member') {
  return put(vault.principals, makePrincipal({ addr, handle, rank }))
}

export function sowBerth(vault: Vault, label: string, wing = 'east', tariffMinor = 9000) {
  return put(vault.berths, makeBerth({ label, wing, tariffMinor }))
}

export function sowAllotment(vault: Vault, principalId: string, berthId: string) {
  return put(vault.allotments, makeAllotment({ principalId, berthId, phase: 'held', blazon: 'ABCDEFGH' }))
}

export function sowIndenture(vault: Vault, principalId: string, minor = 900) {
  return put(vault.indentures, makeIndenture({ principalId, phase: 'open', minor }))
}

export function sowBulletin(vault: Vault, addr: string, subject: string) {
  return put(vault.bulletins, makeBulletin({ addr, subject }))
}

export function sowHoldfast(vault: Vault, principalId: string, berthId: string) {
  return put(vault.holdfasts, makeHoldfast({ principalId, berthId, phase: 'waiting' }))
}

export function labels(): string[] {
  return [...LABELS]
}

export function sow() {
  const vault = createVault()
  const principal = sowPrincipal(vault, 'ada@lodge.test', 'Ada', 'admin')
  sowPrincipal(vault, 'al@lodge.test', 'Al')
  const berths = LABELS.map(label => sowBerth(vault, label))
  sowAllotment(vault, principal.id, berths[0]!.id)
  sowIndenture(vault, principal.id)
  sowBulletin(vault, principal.addr, 'digest')
  sowHoldfast(vault, principal.id, berths[1]!.id)
  info('sow', size(vault))
  return vault
}

if (import.meta.main) sow()
