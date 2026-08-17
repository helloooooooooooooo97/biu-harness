import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { LlmClient, ChatMessage, AssistantReply } from './llm.ts'
import type { SessionHandle, SessionService, SessionEvent } from './session.ts'
import type { ToolDefinition, ToolRegistryService } from './tools.ts'
import type { AgentRegistryService } from './agent.ts'
import { DefaultAgentLoop } from './agent-loop.ts'
import { SERVICE_KEYS, ServiceRegistry } from './core.ts'

// 本文件测核心服务接口：① mock 实现可注册；② 循环只依赖接口跑通；③ 换实现循环不变。

class FakeDeepSeek implements LlmClient {
  private calls = 0
  async chat(messages: ChatMessage[]): Promise<AssistantReply> {
    this.calls += 1
    if (this.calls === 1) {
      return {
        content: '我来执行。',
        toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"hi"}' }],
      }
    }
    return { content: '完成。', toolCalls: [] }
  }
}

class MemorySessions implements SessionService {
  private readonly sessions = new Map<string, SessionHandle>()
  create(id = `s${this.sessions.size + 1}`): SessionHandle {
    const events: SessionEvent[] = []
    const handle: SessionHandle = {
      id,
      append(kind, data) {
        const event = { seq: events.length + 1, kind, data }
        events.push(event)
        return event
      },
      events: () => events,
    }
    this.sessions.set(id, handle)
    return handle
  }
  get(id: string): SessionHandle | undefined {
    return this.sessions.get(id)
  }
  list(): string[] {
    return [...this.sessions.keys()]
  }
}

class MemoryTools implements ToolRegistryService {
  private readonly tools = new Map<string, ToolDefinition>()
  register(tool: ToolDefinition): () => void {
    this.tools.set(tool.name, tool)
    return () => this.tools.delete(tool.name)
  }
  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`未知工具: ${name}`)
    return tool.execute(args)
  }
  list(): string[] {
    return [...this.tools.keys()]
  }
}

test('mock 实现满足接口并被 ServiceRegistry 按 key 注册', () => {
  // 验证接口作为契约：任何实现都能注册进 registry，按 key 取回并调用。
  const registry = new ServiceRegistry()
  const llm = new FakeDeepSeek()
  registry.provide(SERVICE_KEYS.llm, llm)
  assert.equal(registry.get<LlmClient>(SERVICE_KEYS.llm), llm)
  assert.ok(registry.has(SERVICE_KEYS.llm))
})

test('DefaultAgentLoop 只依赖接口，完整跑通一回合', async () => {
  // 验证依赖方向：循环注入接口实现后，能完成 工具调用 → 回填 → 最终回答，并把事件写进会话。
  const llm = new FakeDeepSeek()
  const sessions = new MemorySessions()
  const tools = new MemoryTools()
  tools.register({ name: 'echo', description: '回显', execute: async (args) => String(args.text ?? '') })

  const loop = new DefaultAgentLoop({ llm, sessions, tools })
  const result = await loop.run('帮我 echo hi')

  assert.equal(result.reply, '完成。')
  const session = sessions.get('main')!
  const kinds = session.events().map((e) => e.kind)
  assert.deepEqual(kinds, ['user/message', 'assistant/message', 'tool/result', 'assistant/message'])
  assert.equal(result.events, 4)
})

test('换 LLM 实现，循环代码不变', async () => {
  // 验证可替换性：用一个永远直接回答的 mock，循环不修改也能跑。
  const directLlm: LlmClient = {
    async chat() {
      return { content: '直接回答', toolCalls: [] }
    },
  }
  const loop = new DefaultAgentLoop({ llm: directLlm, sessions: new MemorySessions(), tools: new MemoryTools() })
  const result = await loop.run('你好')
  assert.equal(result.reply, '直接回答')
})

test('AgentRegistryService 接口可被简单实现', () => {
  // 验证 agents 服务的最小契约：create/get/dispose。
  const registry: AgentRegistryService = {
    create(id = 'a1') {
      return { id, send: () => {}, cancel: () => {} }
    },
    get(id) {
      return id === 'a1' ? { id, send: () => {}, cancel: () => {} } : undefined
    },
    dispose() {},
  }
  assert.equal(registry.create().id, 'a1')
  assert.ok(registry.get('a1'))
  assert.equal(registry.get('nope'), undefined)
})
