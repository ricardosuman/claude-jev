import type { HttpInit, HttpResponse } from 'claude-code'

const JEV_URL = 'https://api.typesafe.ai/v1/systemone'

export const LEDGER_KEY = 'ledger'

// ponytail: the ledger keeps the last 500 rows in one store key (the store caps
// at 4 MiB of JSON in all); move to a key per day if a longer history matters.
const LEDGER_CAP = 500

export type Question =
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] }

/**
 * One answer as the live API returns it (checked against jev-1.13.0): a score's
 * `legend` and `probabilities` are keyed by the level's index ("0", "1", ...).
 */
export type Answer =
  | { type: 'noul'; noul: number }
  | {
      type: 'choice'
      choice: string
      probabilities: Record<string, number>
      confidence: number
    }
  | {
      type: 'score'
      score: number
      legend: Record<string, string>
      probabilities: Record<string, number>
      confidence: number
    }

export type Usage = { input_tokens: number; output_tokens: number }

export type JevRow = {
  at: number
  purpose: string
  keys: string[]
  ok: boolean
  latencyMs: number
  usage?: Usage
  answers?: Record<string, Answer>
  shadow?: true
}

export type MeasureRow = {
  at: number
  contextTokens?: number
  contextPercent?: number
  costUsd?: number
}

export type DecisionRow = {
  at: number
  purpose: 'route.decision'
  scope: 'session' | 'agent'
  /** what Jev chose, `model/effort` for the session */
  chosen: string
  /** the subagent type for an agent decision */
  subagentType?: string
  /** the model answer's confidence */
  confidence: number
  effortConfidence?: number
  risky?: number
  subtle?: number
  models: string[]
  applied: boolean
  /** what the decision changes, when applied: each only if its own confidence passed */
  appliedModel?: string
  appliedEffort?: string
  /** the current model tier when a decision was held */
  heldModel?: string
  /** the model the session or parent was on when this was decided */
  fromModel?: string
  reason?: string
  /** true when this row is a proposal that was not applied */
  shadow?: true
  /** what the live router would have done for a shadow proposal */
  wouldApply?: boolean
  /** the model that was running while a shadow proposal was made */
  runningModel?: string
  /** the model selected manually after this session decision was applied */
  supersededBy?: string
}

/**
 * One offloaded tool result: its text's length before and after, its chunks,
 * the middle chunks kept, and whether Jev failed into plain head/tail (for a
 * persisted one: the result left as core gave it).
 */
export type OffloadRow = {
  at: number
  purpose: 'offload.result'
  tool: string
  charsIn: number
  charsOut: number
  chunks: number
  kept: number
  fallback: boolean
  /** set when the result is core's persisted stub, whose preview was chosen */
  persisted?: true
  shadow?: true
  /** the chars this shadow proposal would have kept out of the model result */
  charsSaved?: number
}

/** One shadow lane proposal: the live router would have offered delegation. */
export type LaneRow = {
  at: number
  purpose: 'lane.offer'
  shadow: true
  offered: true
  heldModel: string
}

/** One pause check at a main turn's end inside the compaction window: Jev's `p`, and whether a compaction ran. */
export type PauseRow = {
  at: number
  purpose: 'compact.pause'
  percent: number
  p: number
  fired: boolean
  shadow?: true
  /** true when a shadow proposal says compaction would have fired */
  wouldFire?: boolean
}

/** One `jev-find` suggestion and the per-path confidence data behind it. */
export type FindRow = {
  at: number
  purpose: 'find.result'
  paths: string[]
  confidence: number[]
  indices: number[]
  skip_count: number
}

/** One tool group judged for the current task, with the fail-open decision. */
export type ToolDescribeRow = {
  at: number
  purpose: 'tool.describe'
  group: string
  confidence: number | null
  deferred: boolean
}

/** The Jev attempt behind a read-window proposal (tokens and latency, never the prompt). */
export type JevCall = {
  attempted: boolean
  apiOk: boolean
  latencyMs: number
  inputTokens: number
  outputTokens: number
  tokenCost: number
  failure?: string
}

/**
 * One shadow proposal to narrow a Read. The file is always delivered whole;
 * this row records what a window would have been.
 */
export type ReadWindowRow = {
  at: number
  purpose: 'read.window'
  file: string // name only, e.g. 'register.ts', never the full path
  fileLines: number
  windowStart: number
  windowEnd: number
  targetLine?: number // only if Jev succeeded; the centre
  jev: JevCall
  shadow: true // always
}

export type LedgerRow = JevRow | MeasureRow | DecisionRow | OffloadRow | LaneRow | PauseRow | FindRow | ToolDescribeRow | ReadWindowRow

/**
 * The engine calls `ask` and the ledger make, as closures over `$`: the
 * runtime follows `$` only into functions of the file that holds the hook, so
 * register.ts builds this and hands it across the import.
 */
export type JevHost = {
  apiKey: () => Promise<string | undefined>
  now: () => Promise<number>
  sleep: (ms: number, signal: AbortSignal) => Promise<void>
  fetch: (url: string, init: HttpInit) => Promise<HttpResponse>
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  /** Called after a row is stored; UI redraws are best effort. */
  onAppend?: () => void
}

// ponytail: one module-wide queue serializes the store's read-modify-write so
// concurrent appends don't drop rows; enough for one session's hooks.
let appending: Promise<void> = Promise.resolve()

/**
 * Appends a row to the ledger, keeping the newest LEDGER_CAP; never throws.
 */
export function append(host: JevHost, row: LedgerRow): Promise<void> {
  appending = appending.then(async () => {
    const ledger = await readLedger(host)
    await host.storeSet(LEDGER_KEY, [...ledger, row].slice(-LEDGER_CAP))
    try {
      host.onAppend?.()
    } catch {
      // fail-open: a UI redraw must never affect the ledger or its caller
    }
  }).catch(() => undefined)

  return appending
}

export async function readLedger(host: JevHost): Promise<LedgerRow[]> {
  const stored = await host.storeGet(LEDGER_KEY)

  return Array.isArray(stored) ? (stored as LedgerRow[]) : []
}

/**
 * Asks Jev `questions` about `state`. Fail-open: resolves null on a missing
 * key, a timeout, a failed request, a non-2xx or an unreadable body, never
 * later than `timeoutMs`. Every call leaves a ledger row before it returns.
 */
export async function ask(
  host: JevHost,
  purpose: string,
  state: unknown,
  questions: Record<string, Question>,
  timeoutMs: number,
  shadow = false,
): Promise<Record<string, Answer> | null> {
  const key = await host.apiKey().catch(() => undefined)
  const startedAt = await host.now()
  let answers: Record<string, Answer> | undefined
  let usage: Usage | undefined

  if (key) {
    // ponytail: the host's fetch takes no signal, so a timed-out request runs on in
    // the background; only the caller stops waiting for it.
    const stop = new AbortController()
    const timedOut = host.sleep(timeoutMs, stop.signal).then(() => null, () => null)

    try {
      const response = await Promise.race([
        host.fetch(JEV_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: 'jev-latest', state, questions }),
        }),
        timedOut,
      ])

      if (response?.ok) {
        const body = JSON.parse(response.text) as {
          answers?: Record<string, Answer>
          usage?: Usage
        }
        answers = body.answers && typeof body.answers === 'object' ? body.answers : undefined
        usage = body.usage
      }
    } catch {
      // fail-open: the row below records ok: false
    } finally {
      stop.abort()
    }
  }

  const at = await host.now()

  await append(host, {
    at,
    purpose,
    keys: Object.keys(questions),
    ok: answers !== undefined,
    latencyMs: at - startedAt,
    usage,
    answers,
    ...(shadow ? { shadow: true as const } : {}),
  })

  return answers ?? null
}
