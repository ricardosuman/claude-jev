const UNITS: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 }

export function parsePort(env: Record<string, string | undefined>): number {
  const port = Number(env.PORT ?? 3000)
  if (!Number.isInteger(port)) throw new Error(`bad PORT: ${env.PORT}`)
  return port
}

export function parseDuration(text: string): number {
  const match = /^(\d+)(ms|s|m|h)$/.exec(text)
  if (!match) throw new Error(`bad duration: ${text}`)
  return Number(match[1]) * UNITS[match[2]!]!
}
