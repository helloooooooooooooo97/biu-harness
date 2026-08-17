/** MockLlm：fixture 录放实现（Provider）。 */
import { readFileSync } from 'node:fs'
import type { LlmClient } from './llm.ts'
import type { AssistantReply, ChatMessage, ToolCall } from './types.ts'

export interface Fixture {
  key: string
  content?: string
  toolCalls?: ToolCall[]
}

/** fixture 仓库：按 key 索引，同 key 按序消费（队列）。 */
export class FixtureStore {
  private readonly queue = new Map<string, Fixture[]>()

  constructor(fixtures: Fixture[] = []) {
    for (const fixture of fixtures) this.add(fixture)
  }

  add(fixture: Fixture): void {
    const list = this.queue.get(fixture.key) ?? []
    list.push(fixture)
    this.queue.set(fixture.key, list)
  }

  take(key: string): Fixture | undefined {
    const list = this.queue.get(key)
    if (!list?.length) return undefined
    const fixture = list.shift()
    if (list.length === 0) this.queue.delete(key)
    return fixture
  }

  has(key: string): boolean {
    return (this.queue.get(key)?.length ?? 0) > 0
  }

  static fromJsonl(text: string): FixtureStore {
    const store = new FixtureStore()
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue
      store.add(JSON.parse(line) as Fixture)
    }
    return store
  }

  static fromFiles(paths: string[]): FixtureStore {
    const store = new FixtureStore()
    for (const path of paths) {
      const loaded = FixtureStore.fromJsonl(readFileSync(path, 'utf8'))
      for (const fixture of [...loaded.queue.values()].flat()) store.add(fixture)
    }
    return store
  }
}

/** 命中 key：本课用最后一条 user 消息的文本。 */
export function keyOf(messages: ChatMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === 'user')
  return last?.content ?? ''
}

export class MockLlm implements LlmClient {
  constructor(
    private readonly store: FixtureStore,
    private readonly fallback?: string,
  ) {}

  async chat(messages: ChatMessage[]): Promise<AssistantReply> {
    const key = keyOf(messages)
    const fixture = this.store.take(key)
    if (!fixture) {
      if (this.fallback != null) return { content: this.fallback, toolCalls: [] }
      throw new Error(`mock 未命中: ${key}`)
    }
    return { content: fixture.content ?? '', toolCalls: fixture.toolCalls ?? [] }
  }
}
