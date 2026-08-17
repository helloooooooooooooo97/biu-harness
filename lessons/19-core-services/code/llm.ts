/** LLM 服务接口：模型调用的最小契约。 */

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
