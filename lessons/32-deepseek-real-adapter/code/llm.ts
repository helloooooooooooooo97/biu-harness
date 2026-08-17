/** LLM 统一词汇表与适配器接缝（复用第 31 课）。 */

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'image'; image: string }
  | { type: 'tool-call'; id: string; name: string; arguments: string }
  | { type: 'tool-result'; toolCallId: string; content: ContentBlock[]; isError?: boolean }

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: ContentBlock[]
  source?: { kind: string; plugin?: string }
}

export type StreamChunk =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call-delta'; id: string; name?: string; argumentsDelta: string }
  | { type: 'finish'; reason: string }

export interface LlmAdapter {
  provider: string
  stream(messages: Message[], options?: { signal?: AbortSignal }): AsyncGenerator<StreamChunk>
}

export async function assemble(chunks: AsyncIterable<StreamChunk>): Promise<Message> {
  return (async () => {
    const textParts: string[] = []
    const reasoningParts: string[] = []
    const toolCalls = new Map<string, { id: string; name: string; arguments: string }>()
    for await (const chunk of chunks) {
      if (chunk.type === 'text') textParts.push(chunk.text)
      else if (chunk.type === 'reasoning') reasoningParts.push(chunk.text)
      else if (chunk.type === 'tool-call-delta') {
        const current = toolCalls.get(chunk.id) ?? { id: chunk.id, name: '', arguments: '' }
        if (chunk.name) current.name += chunk.name
        current.arguments += chunk.argumentsDelta
        toolCalls.set(chunk.id, current)
      }
    }
    const content: ContentBlock[] = []
    if (reasoningParts.length) content.push({ type: 'reasoning', text: reasoningParts.join('') })
    if (textParts.length) content.push({ type: 'text', text: textParts.join('') })
    for (const call of toolCalls.values()) {
      content.push({ type: 'tool-call', id: call.id, name: call.name, arguments: call.arguments })
    }
    return { role: 'assistant' as const, content, source: { kind: 'model' } }
  })()
}
