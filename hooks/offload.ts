import type { Answer } from './jev'

const CHUNK_CHARS = 1500
const MAX_CHUNKS = 40
const FALLBACK_CHARS = 3000
// ponytail: the docs give Jev ~32k tokens per request (docs.typesafe.ai/primitives),
// but live calls past it answered right: 250 questions of 400 chars (100k chars,
// 65k tokens) in 0.8-1.6 s, 38 of 2600 (58k tokens) in 1.5 s, the one FATAL chunk
// at 0.90-0.93 and every other under 0.25. Dense logs run ~1.6 chars/token; 38 of
// 1400 chars (32k tokens) took p50 0.42 s. Past ASK_CHARS nothing is asked (not
// needed); a second call in parallel reads further if that matters.
const ASK_CHARS = 100_000
// a call asking more than this many chars gets twice the timeout (the 58k-65k token calls took 0.8-1.6 s)
export const SLOW_ASK_CHARS = 45_000
// core cuts a persisted output's stub preview at 2000 chars (measured live); the
// preview's chunks are small so head, tail and a needed chunk fit in it
export const PREVIEW_CHARS = 2000
export const PREVIEW_CHUNK_CHARS = 400

/**
 * `text` cut at line ends into chunks of about CHUNK_CHARS (a longer line is a
 * chunk of its own), the middle ones merged with their neighbours so there are
 * at most MAX_CHUNKS; joined, the chunks are `text`. Head and tail stay one
 * chunk each so what is always kept stays small.
 */
export function chunksOf(text: string, chars = CHUNK_CHARS, max = MAX_CHUNKS): string[] {
  const chunks: string[] = []

  for (const line of text.split(/(?<=\n)/)) {
    if (chunks.length > 0 && chunks.at(-1)!.length + line.length <= chars) chunks[chunks.length - 1] += line
    else chunks.push(line)
  }
  if (chunks.length <= max) return chunks

  const middle = chunks.slice(1, -1)
  const size = Math.ceil(middle.length / (max - 2))
  const merged: string[] = []
  for (let i = 0; i < middle.length; i += size) merged.push(middle.slice(i, i + size).join(''))

  return [chunks[0]!, ...merged, chunks.at(-1)!]
}

/**
 * The middle chunks' indexes Jev is asked about: in order, while their text
 * fits `budget` chars.
 */
export function askedOf(chunks: readonly string[], budget = ASK_CHARS): number[] {
  const asked: number[] = []
  let chars = 0

  for (let i = 1; i < chunks.length - 1; i++) {
    chars += chunks[i]!.length
    if (chars > budget) break
    asked.push(i)
  }

  return asked
}

/**
 * Which of the `asked` chunks to keep, each with its noul: those at least
 * `threshold`, and the single highest (the first of equals) whatever its noul,
 * so the best candidate survives a weak signal; null when any answer is
 * missing or not a noul in [0, 1]. Jev is external input; nothing unchecked is
 * kept on.
 */
export function keptOf(answers: Record<string, Answer>, asked: readonly number[], threshold: number): Map<number, number> | null {
  const kept = new Map<number, number>()
  let best: [number, number] | undefined

  for (const i of asked) {
    const noul = noulOf(answers[`c${i}`])
    if (noul === null) return null
    if (noul >= threshold) kept.set(i, noul)
    if (best === undefined || noul > best[1]) best = [i, noul]
  }
  if (best) kept.set(...best)

  return kept
}

/**
 * The noul of an answer, or null when it is not a noul in [0, 1].
 */
export function noulOf(answer: unknown): number | null {
  if (typeof answer !== 'object' || answer === null) return null
  const { type, noul } = answer as Record<string, unknown>

  return type === 'noul' && typeof noul === 'number' && noul >= 0 && noul <= 1 ? noul : null
}

/**
 * The chunks in order, the head, the tail and the `kept` ones as they are, each
 * run of the others one marker line naming `path`.
 */
export function assembled(chunks: readonly string[], kept: { has: (i: number) => boolean }, path: string): string {
  let out = ''
  let omitted = ''

  chunks.forEach((chunk, i) => {
    if (i === 0 || i === chunks.length - 1 || kept.has(i)) {
      if (omitted !== '') out += `${markerOf(omitted, path)}\n`
      omitted = ''
      out += chunk
    } else {
      omitted += chunk
    }
  })

  return out
}

/**
 * The chunks that go into the output beside head and tail: the `kept` ones,
 * most needed first, each while the assembled whole still fits `cap`; null
 * when head and tail alone do not.
 */
export function previewOf(chunks: readonly string[], kept: ReadonlyMap<number, number>, path: string, cap: number): Set<number> | null {
  const chosen = new Set<number>()
  if (assembled(chunks, chosen, path).length > cap) return null

  for (const [i] of [...kept].sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
    chosen.add(i)
    if (assembled(chunks, chosen, path).length > cap) chosen.delete(i)
  }

  return chosen
}

/**
 * Plain head/tail: the first and last FALLBACK_CHARS of `text` (a quarter each
 * of a shorter one, and within `cap` beside the marker) around a marker.
 */
export function headTail(text: string, path: string, cap: number): string {
  const n = Math.min(FALLBACK_CHARS, Math.floor(text.length / 4), Math.floor(cap / 2) - 100)

  return `${text.slice(0, n)}\n${markerOf(text.slice(n, -n), path)}\n${text.slice(-n)}`
}

/**
 * The line standing for `omitted`: its lines (a cut partial line counts as one)
 * and chars, and where the whole output is.
 */
export function markerOf(omitted: string, path: string): string {
  const lines = omitted.split('\n').length - (omitted.endsWith('\n') ? 1 : 0)

  return `[… ${lines} lines / ${omitted.length} chars omitted — full output: ${path}; Read it if needed]`
}

/**
 * Where a call's full output goes under `root`: `.claude/jev/<id>.txt`, the id
 * cut to word chars and dashes so it cannot leave the directory.
 */
export function pathOf(root: string, toolUseId: string): string {
  return `${root}/.claude/jev/${toolUseId.replace(/[^\w-]/g, '_')}.txt`
}

/**
 * The text the model reads of a tool's `result`, from the fields its mapper
 * renders (Bash: stdout then stderr; WebFetch: `result`; MCP: its text), or
 * undefined for a result this does not rewrite (an image, output core already
 * persisted, non-text MCP content).
 */
export function bodyOf(tool: string, result: unknown): string | undefined {
  if (tool.startsWith('mcp__')) {
    if (typeof result === 'string') return result
    if (!Array.isArray(result) || !result.every(isTextBlock)) return undefined

    return result.map(block => block.text).join('\n')
  }
  if (typeof result !== 'object' || result === null) return undefined

  const r = result as Record<string, unknown>
  if (tool === 'WebFetch') return typeof r.result === 'string' ? r.result : undefined
  if (tool !== 'Bash' || typeof r.stdout !== 'string' || typeof r.stderr !== 'string') return undefined
  if (r.isImage || r.persistedOutputPath !== undefined) return undefined

  return [r.stdout, r.stderr].filter(Boolean).join('\n')
}

/**
 * `result` with `body` in place of its text, valid against the tool's output
 * schema: Bash's stdout (stderr folded in), WebFetch's `result`, an MCP string.
 */
export function withBody(tool: string, result: unknown, body: string): unknown {
  if (tool.startsWith('mcp__')) return body
  if (tool === 'WebFetch') return { ...(result as object), result: body }

  return { ...(result as object), stdout: body, stderr: '' }
}

function isTextBlock(block: unknown): block is { type: 'text'; text: string } {
  return typeof block === 'object' && block !== null && (block as { type?: unknown }).type === 'text' && typeof (block as { text?: unknown }).text === 'string'
}
