/** LLM 最小接口。 */

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolCallId?: string
}

export interface AssistantReply {
  content: string
  toolCalls: ToolCall[]
}

export interface LlmClient {
  chat(messages: ChatMessage[]): Promise<AssistantReply>
}
