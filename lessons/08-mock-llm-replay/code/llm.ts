/** LlmClient：LLM 适配器接缝（Definition）。 */
import type { AssistantReply, ChatMessage } from './types.ts'

export interface LlmClient {
  chat(messages: ChatMessage[]): Promise<AssistantReply>
}
