/** 共享类型。 */

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
}

export interface AssistantReply {
  content: string
  toolCalls: ToolCall[]
}

export interface LlmClient {
  chat(messages: ChatMessage[]): Promise<AssistantReply>
}
