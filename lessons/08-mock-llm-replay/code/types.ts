/** 跨模块共享的消息与工具调用类型。 */
export interface ToolCall {
  id: string
  name: string
  /** 模型原样输出的参数 JSON 字符串。 */
  arguments: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string
  toolCalls?: ToolCall[]
  toolCallId?: string
}

export interface AssistantReply {
  content: string
  toolCalls: ToolCall[]
}
