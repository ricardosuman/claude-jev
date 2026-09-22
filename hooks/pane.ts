import type { DecisionRow, JevRow, LedgerRow, MeasureRow, OffloadRow } from './jev'

/**
 * The one-line transcript record for a routing decision. It only accepts
 * values already present in a ledger decision row; no task text is included.
 */
export function decisionLineOf(row: Omit<DecisionRow, 'at'>): string {
  const subject = row.scope === 'session' ? 'session' : row.subagentType ?? 'general-purpose'

  if (row.shadow) {
    if (row.wouldApply) {
      return `jev (shadow): would route ${subject} ${row.chosen} (${row.confidence.toFixed(2)}) — running ${row.runningModel ?? row.heldModel ?? '?'}`
    }

    const held = row.heldModel === undefined ? '' : ` on ${row.heldModel}`

    return `jev (shadow): would hold ${subject}${held} (${reasonTextOf(row)})`
  }

  if (row.supersededBy !== undefined) {
    return `jev: ${subject} decision dropped, /model ${row.supersededBy}`
  }

  if (row.applied) {
    return `jev: ${subject} → ${row.chosen} (${row.confidence.toFixed(2)})`
  }

  const held = row.heldModel === undefined ? ' held' : ` held on ${row.heldModel}`

  return `jev: ${subject}${held} (${reasonTextOf(row)})`
}

/**
 * The plain text body of the /jev pane. All values are derived from ledger
 * rows; the pane keeps no parallel counters or decision state.
 */
export function paneTextOf(ledger: readonly LedgerRow[]): string {
  const decisions = ledger.filter((row): row is DecisionRow => 'scope' in row)
  const session = decisions.filter(row => row.scope === 'session').at(-1)
  const agents = decisions.filter(row => row.scope === 'agent').slice(-10).reverse()
  const calls = ledger.filter((row): row is JevRow => 'keys' in row)
  const measure = ledger.filter((row): row is MeasureRow => !('purpose' in row)).at(-1)
  const offloads = ledger.filter((row): row is OffloadRow => 'purpose' in row && row.purpose === 'offload.result')
  const latencies = calls.map(row => row.latencyMs).sort((a, b) => a - b)
  const p50 = latencies[Math.floor((latencies.length - 1) / 2)]
  const ok = calls.filter(row => row.ok).length
  const tokensIn = calls.reduce((sum, row) => sum + (row.usage?.input_tokens ?? 0), 0)
  const tokensOut = calls.reduce((sum, row) => sum + (row.usage?.output_tokens ?? 0), 0)
  const charsIn = offloads.reduce((sum, row) => sum + row.charsIn, 0)
  const charsOut = offloads.reduce((sum, row) => sum + row.charsOut, 0)
  const fallbacks = offloads.filter(row => row.fallback).length
  const shadowDecisions = decisions.filter(row => row.shadow)
  const shadowOffloads = offloads.filter(row => row.shadow)
  const shadowPauses = ledger.filter(
    (row): row is Extract<LedgerRow, { purpose: 'compact.pause' }> => 'purpose' in row && row.purpose === 'compact.pause' && row.shadow === true,
  )
  const shadowSaved = shadowOffloads.reduce((sum, row) => sum + (row.charsSaved ?? Math.max(0, row.charsIn - row.charsOut)), 0)
  const cost = measure?.costUsd === undefined ? '-' : `$${measure.costUsd.toFixed(4)}`
  const context = measure?.contextPercent === undefined ? '-' : `${measure.contextPercent}%`
  const shadowOffloadText = shadowOffloads.length > 0 && shadowOffloads.length === offloads.length ? 'would save' : 'trimmed'

  return [
    `Session: ${sessionTextOf(session)}`,
    'Agents:',
    ...(agents.length === 0
      ? ['  -']
      : agents.map(row => agentTextOf(row))),
    `Offload: ${offloads.length} ${shadowOffloadText} · ${charsIn} in → ${charsOut} out · ${fallbacks} ${fallbacks === 1 ? 'fallback' : 'fallbacks'}`,
    ...(shadowDecisions.length > 0 || shadowOffloads.length > 0 || shadowPauses.length > 0
      ? [
          `Shadow: ${shadowDecisions.filter(row => row.wouldApply === true).length} downgrades · ${shadowDecisions.filter(row => row.wouldApply !== true).length} holds · ${shadowSaved} chars would be saved`,
        ]
      : []),
    `Jev: ${calls.length} calls · ${ok} ok/${calls.length - ok} failed · p50 ${p50 === undefined ? '-' : `${p50} ms`}`,
    `Tokens: ${tokensIn} in / ${tokensOut} out`,
    `Cost: ${cost} · Context: ${context}`,
    ...(shadowPauses.length > 0
      ? [`Compact: ${shadowPauses.filter(row => row.wouldFire === true).length}/${shadowPauses.length} pauses would fire`]
      : []),
  ].join('\n')
}

function sessionTextOf(row: DecisionRow | undefined): string {
  if (row === undefined) return '-'

  if (row.shadow) {
    if (row.wouldApply) return `would route ${row.chosen} · ${row.confidence.toFixed(2)} · running ${row.runningModel ?? '?'}`

    const held = row.heldModel === undefined ? 'held' : `held on ${row.heldModel}`

    return `would hold ${row.chosen} · ${row.confidence.toFixed(2)} · ${held}: ${row.reason ?? 'not applied'}`
  }

  if (row.supersededBy !== undefined) return `${row.chosen} · ${row.confidence.toFixed(2)} · superseded by /model ${row.supersededBy}`

  if (row.applied) return `${row.chosen} · ${row.confidence.toFixed(2)} · applied`

  const held = row.heldModel === undefined ? 'held' : `held on ${row.heldModel}`

  return `${row.chosen} · ${row.confidence.toFixed(2)} · ${held}: ${row.reason ?? 'not applied'}`
}

function reasonTextOf(row: Omit<DecisionRow, 'at'>): string {
  if (row.reason === 'risky' && row.risky !== undefined) return `risky ${row.risky.toFixed(2)}`
  if (row.reason === 'subtle' && row.subtle !== undefined) return `subtle ${row.subtle.toFixed(2)}`
  if (row.reason === 'low confidence') return `low confidence ${row.confidence.toFixed(2)}`

  return row.reason ?? 'not applied'
}

function agentTextOf(row: DecisionRow): string {
  const subject = row.subagentType ?? 'general-purpose'

  if (row.shadow) {
    return row.wouldApply
      ? `  ${subject} would route ${row.chosen} · ${row.confidence.toFixed(2)} · running ${row.runningModel ?? '?'}`
      : `  ${subject} would hold on ${row.heldModel ?? '?'} · ${row.confidence.toFixed(2)} · ${row.reason ?? 'not applied'}`
  }

  return `  ${subject} → ${row.chosen} · ${row.confidence.toFixed(2)}`
}
