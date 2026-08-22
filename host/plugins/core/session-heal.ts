import type { SessionEvent, SessionEventBody } from './session-types.ts'

export type OpenTurnStep = {
  openTurn: number | null
  openStep: { turn: number; step: number } | null
}

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
 * 进程崩溃 / 重启后，把未闭合的 step、turn 补上结束事件。
 * 先 step/end，再 turn/end（reason=host-restart）。
 */
export function healInterruptedTurnBodies(events: SessionEvent[]): SessionEventBody[] {
  const { openTurn, openStep } = findOpenTurnStep(events)
  const out: SessionEventBody[] = []
  if (openStep) {
    out.push({ type: 'step/end', turn: openStep.turn, step: openStep.step })
  }
  if (openTurn != null) {
    out.push({ type: 'turn/end', turn: openTurn, reason: 'host-restart' })
  }
  return out
}
