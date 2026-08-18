/** 共享类型。 */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantReply {
  content: string
  toolCalls: Array<{ id: string; name: string; arguments: string }>
}

export interface LlmClient {
  chat(messages: ChatMessage[]): Promise<AssistantReply>
}
