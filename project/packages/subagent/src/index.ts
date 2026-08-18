/** 子代理能力缝：Definition + Provider（第 49 课）。 */
import type { LlmClient } from '@mini-dsh/llm'

export interface SubagentHandle {
  id: string
  result: Promise<string>
}

export interface SubagentProvider {
  name: string
  spawn(prompt: string, options?: { maxSteps?: number }): SubagentHandle
}

export class SubagentRegistry {
  private readonly providers = new Map<string, SubagentProvider>()

  register(provider: SubagentProvider): () => void {
    if (this.providers.has(provider.name)) throw new Error(`provider 已存在: ${provider.name}`)
    this.providers.set(provider.name, provider)
    return () => this.providers.delete(provider.name)
  }

  get(name: string): SubagentProvider {
    const provider = this.providers.get(name)
    if (!provider) throw new Error(`未知 provider: ${name}`)
    return provider
  }
}

let nextId = 0

export class InProcessProvider implements SubagentProvider {
  readonly name = 'inprocess'

  constructor(private readonly llm: LlmClient) {}

  spawn(prompt: string): SubagentHandle {
    nextId += 1
    return { id: `sub-${nextId}`, result: this.llm.chat([{ role: 'user', content: prompt }]).then((r) => r.content) }
  }
}

export class AcpProviderMock implements SubagentProvider {
  readonly name = 'acp'

  constructor(private readonly canned = '远程子代理结果') {}

  spawn(prompt: string): SubagentHandle {
    nextId += 1
    return { id: `acp-${nextId}`, result: Promise.resolve(`${this.canned}（${prompt.slice(0, 10)}…）`) }
  }
}
