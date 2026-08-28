import type { ChatNode, ChatToolPart, TrajectoryUsage } from '@biu/web-session-view'

export type LiveHudFlash = { kind: 'tool' | 'output'; text: string; key: string }

export type LiveHudState = {
  turn: number
  step: number
  toolIndex: number
  durationMs?: number
  usage?: TrajectoryUsage
  lastTool: ChatToolPart | undefined
  lastOutput: string
  streaming: boolean
}

export function replyToolCount(reply: Extract<ChatNode, { kind: 'reply' }>) {
  const fromParts = reply.parts.reduce((count, part) => count + (part.kind === 'tool' ? 1 : 0), 0)
  if (fromParts > 0) return fromParts
  return (reply.steps ?? []).reduce((count, step) => count + step.toolCount, 0)
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`
  if (ms < 60_000) {
    const sec = ms / 1000
    return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`
  }
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

export function extractLiveHud(nodes: ChatNode[], agentStep?: number): LiveHudState {
  let users = 0
  let lastReply: Extract<ChatNode, { kind: 'reply' }> | undefined
  for (const node of nodes) {
    if (node.kind === 'user') users += 1
    if (node.kind === 'reply') lastReply = node
  }
  const tools = lastReply?.parts.filter((part): part is ChatToolPart => part.kind === 'tool') ?? []
  const lastAssistant = [...(lastReply?.parts ?? [])]
    .reverse()
    .find((part) => part.kind === 'assistant' && part.text.trim())
  const fromParts = lastReply ? replyToolCount(lastReply) : 0
  return {
    turn: lastReply?.turn ?? users,
    step: lastReply?.stepCount ?? lastReply?.steps?.length ?? agentStep ?? 0,
    toolIndex: fromParts || tools.length,
    durationMs: lastReply?.durationMs,
    usage: lastReply?.usage,
    lastTool: tools.at(-1),
    lastOutput: lastAssistant?.kind === 'assistant' ? lastAssistant.text.trim() : '',
    streaming: Boolean(lastReply?.streaming),
  }
}

export function clipHudText(text: string, max = 80) {
  const one = text.replace(/\s+/g, ' ').trim()
  if (one.length <= max) return one
  return `${one.slice(0, max)}…`
}
