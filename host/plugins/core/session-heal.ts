import type { SessionEvent, SessionEventBody } from './session-types.ts'

export type OpenTurnStep = {
  openTurn: number | null
  openStep: { turn: number; step: number } | null
}

const INTERRUPTED_TOOL_DETAIL =
  'interrupted: tool call was not completed (host restart or crash before tool/result)'

/** 扫描事件日志：未配对的 turn/start、step/start。 */
export function findOpenTurnStep(events: SessionEvent[]): OpenTurnStep {
  let openTurn: number | null = null
  let openStep: { turn: number; step: number } | null = null
  for (const event of events) {
    if (event.type === 'turn/start') {
      openTurn = event.turn
      openStep = null
      continue
    }
    if (event.type === 'step/start') {
      openTurn = event.turn
      openStep = { turn: event.turn, step: event.step }
      continue
    }
    if (event.type === 'step/end') {
      if (openStep && openStep.turn === event.turn && openStep.step === event.step) {
        openStep = null
      }
      continue
    }
    if (event.type === 'turn/end') {
      openTurn = null
      openStep = null
    }
  }
  return { openTurn, openStep }
}

/**
 * assistant/message.tool_calls 里尚未出现对应 tool/result 的 id。
 * 崩溃常停在「已写 tool_calls、未写 result」——下一轮 LLM 会拒收整段历史。
 */
export function findOrphanToolCalls(
  events: SessionEvent[],
): Array<{ id: string; name: string }> {
  const pending = new Map<string, string>()
  for (const event of events) {
    if (event.type === 'assistant/message' && event.tool_calls?.length) {
      for (const call of event.tool_calls) {
        pending.set(call.id, call.name)
      }
    } else if (event.type === 'tool/result') {
      pending.delete(event.id)
    }
  }
  return [...pending.entries()].map(([id, name]) => ({ id, name }))
}

export function orphanToolResultBodies(
  orphans: Array<{ id: string; name: string }>,
): SessionEventBody[] {
  return orphans.map((call) => ({
    type: 'tool/result',
    id: call.id,
    name: call.name,
    ok: false,
    detail: INTERRUPTED_TOOL_DETAIL,
  }))
}

/**
 * 进程崩溃 / 重启后补齐日志：
 * 1) 缺失的 tool/result（先于 step/turn 结束）
 * 2) 未闭合的 step/end、turn/end（reason=host-restart）
 */
export function healInterruptedTurnBodies(events: SessionEvent[]): SessionEventBody[] {
  const orphans = findOrphanToolCalls(events)
  const { openTurn, openStep } = findOpenTurnStep(events)
  const out: SessionEventBody[] = [...orphanToolResultBodies(orphans)]
  if (openStep) {
    out.push({ type: 'step/end', turn: openStep.turn, step: openStep.step })
  }
  if (openTurn != null) {
    out.push({ type: 'turn/end', turn: openTurn, reason: 'host-restart' })
  }
  return out
}

export { INTERRUPTED_TOOL_DETAIL }
