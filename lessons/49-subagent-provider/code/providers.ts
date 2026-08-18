/** 子代理 Provider：in-process + ACP/远程 mock（第 49 课）。 */
import type { LlmClient } from './types.ts'
import type { SubagentHandle, SubagentProvider } from './subagent.ts'

let nextId = 0

export class InProcessProvider implements SubagentProvider {
  readonly name = 'inprocess'

  constructor(private readonly llm: LlmClient) {}

  spawn(prompt: string): SubagentHandle {
    nextId += 1
    const id = `sub-${nextId}`
    const result = this.llm.chat([{ role: 'user', content: prompt }]).then((reply) => reply.content)
    return { id, result }
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

