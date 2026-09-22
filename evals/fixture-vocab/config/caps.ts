export type CapsConfig = {
  berthFolioSize: number
  uploadMb: number
  bulletinMax: number
  windowItems: number
}

export const HARD_BERTH_CAP = 10_000

/**
 * Keys:
 * BERTH_FOLIO_SIZE — berthFolioSize (20)
 * UPLOAD_MB — uploadMb (8)
 * BULLETIN_MAX — bulletinMax (4000)
 * CAP_WINDOW_ITEMS — windowItems (500)
 */
export function loadCaps(env: Record<string, string | undefined> = process.env): CapsConfig {
  return {
    berthFolioSize: Number(env.BERTH_FOLIO_SIZE ?? 20),
    uploadMb: Number(env.UPLOAD_MB ?? 8),
    bulletinMax: Number(env.BULLETIN_MAX ?? 4000),
    windowItems: Number(env.CAP_WINDOW_ITEMS ?? 500),
  }
}

export function freezeCapsConfig(cfg: CapsConfig): Readonly<CapsConfig> {
  return Object.freeze({ ...cfg })
}

export function describeCapsConfig(cfg: CapsConfig): string {
  return Object.entries(cfg)
    .map(([k, v]) => k + '=' + String(v))
    .join(' ')
}

export function mergeCapsConfig(base: CapsConfig, patch: Partial<CapsConfig>): CapsConfig {
  return { ...base, ...patch }
}

export function pickCapsConfig<K extends keyof CapsConfig>(cfg: CapsConfig, keys: K[]): Pick<CapsConfig, K> {
  const out = {} as Pick<CapsConfig, K>
  for (const key of keys) out[key] = cfg[key]
  return out
}
