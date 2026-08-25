import type { InboxKind, MessageSender } from '@biu/type-session'

export interface AgentTurn {
  text: string
  steps: Array<{ name: string; ok: boolean; detail: string }>
}

export interface ClaimedInput {
  kind: InboxKind
  text: string
  id?: string
  extraTools?: string[]
  sender?: MessageSender
}

export interface PreStepReq {
  sessionId: string
  messages: ClaimedInput[]
  reject?: string
}

export interface AgentRunner {
  run(claimed: ClaimedInput[]): Promise<AgentTurn>
}
