export type FlagsConfig = {
  newCheckout: boolean
  auditVerbose: boolean
  shipmentsV2: boolean
  windowPreview: boolean
}

export const FLAG_SOURCE = 'env'

/**
 * Environment keys:
 * FLAG_NEW_CHECKOUT — newCheckout (default false)
 * FLAG_AUDIT_VERBOSE — auditVerbose (default true)
 * FLAG_SHIPMENTS_V2 — shipmentsV2 (default false)
 * FLAG_WINDOW_PREVIEW — windowPreview (default false)
 */
export function loadFlags(env: Record<string, string | undefined> = process.env): FlagsConfig {
  return {
    newCheckout: env.FLAG_NEW_CHECKOUT === '1' || env.FLAG_NEW_CHECKOUT === 'true' ? true : env.FLAG_NEW_CHECKOUT === '0' || env.FLAG_NEW_CHECKOUT === 'false' ? false : false,
    auditVerbose: env.FLAG_AUDIT_VERBOSE === '1' || env.FLAG_AUDIT_VERBOSE === 'true' ? true : env.FLAG_AUDIT_VERBOSE === '0' || env.FLAG_AUDIT_VERBOSE === 'false' ? false : true,
    shipmentsV2: env.FLAG_SHIPMENTS_V2 === '1' || env.FLAG_SHIPMENTS_V2 === 'true' ? true : env.FLAG_SHIPMENTS_V2 === '0' || env.FLAG_SHIPMENTS_V2 === 'false' ? false : false,
    windowPreview: env.FLAG_WINDOW_PREVIEW === '1' || env.FLAG_WINDOW_PREVIEW === 'true' ? true : env.FLAG_WINDOW_PREVIEW === '0' || env.FLAG_WINDOW_PREVIEW === 'false' ? false : false,
  }
}

export function freezeFlagsConfig(cfg: FlagsConfig): Readonly<FlagsConfig> {
  return Object.freeze({ ...cfg })
}

export function describeFlagsConfig(cfg: FlagsConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeFlagsConfig(base: FlagsConfig, patch: Partial<FlagsConfig>): FlagsConfig {
  return { ...base, ...patch }
}

export function pickFlagsConfig<K extends keyof FlagsConfig>(cfg: FlagsConfig, keys: K[]): Pick<FlagsConfig, K> {
  const out = {} as Pick<FlagsConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
