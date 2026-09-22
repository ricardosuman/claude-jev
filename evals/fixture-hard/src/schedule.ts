const WEEK = 7 * 24 * 60 * 60 * 1000

/** Offset of `timeZone` from UTC at instant `t`, in ms (positive east of UTC). */
export function tzOffset(t: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t))
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value)
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return wall - Math.floor(t / 1000) * 1000
}

/** UTC instant (ms) of the wall-clock time `local` ('YYYY-MM-DDTHH:mm') in `timeZone`. */
export function zonedToUtc(local: string, timeZone: string): number {
  const guess = Date.parse(`${local}:00Z`)
  return guess - tzOffset(guess, timeZone)
}

/** The first `count` weekly occurrences of an event that starts at `firstLocal` in `timeZone`, as UTC ISO strings. */
export function weekly(firstLocal: string, timeZone: string, count: number): string[] {
  const first = zonedToUtc(firstLocal, timeZone)
  return Array.from({ length: count }, (_, i) => new Date(first + i * WEEK).toISOString())
}
