export type FlagsConfig = {
  newEmbark: boolean
  auditVerbose: boolean
  allotmentsV2: boolean
  windowPreview: boolean
}

export const FLAG_SOURCE = 'env'

/**
 * Keys:
 * FLAG_NEW_EMBARK — newEmbark (false)
 * FLAG_AUDIT_VERBOSE — auditVerbose (true)
 * FLAG_ALLOTMENTS_V2 — allotmentsV2 (false)
 * FLAG_WINDOW_PREVIEW — windowPreview (false)
 */
export function loadFlags(env: Record<string, string | undefined> = process.env): FlagsConfig {
  return {
    newEmbark: env.FLAG_NEW_EMBARK === '1' || env.FLAG_NEW_EMBARK === 'true' ? true : env.FLAG_NEW_EMBARK === '0' || env.FLAG_NEW_EMBARK === 'false' ? false : false,
    auditVerbose: env.FLAG_AUDIT_VERBOSE === '1' || env.FLAG_AUDIT_VERBOSE === 'true' ? true : env.FLAG_AUDIT_VERBOSE === '0' || env.FLAG_AUDIT_VERBOSE === 'false' ? false : true,
    allotmentsV2: env.FLAG_ALLOTMENTS_V2 === '1' || env.FLAG_ALLOTMENTS_V2 === 'true' ? true : env.FLAG_ALLOTMENTS_V2 === '0' || env.FLAG_ALLOTMENTS_V2 === 'false' ? false : false,
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
