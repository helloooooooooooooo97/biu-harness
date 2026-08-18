/**
 * CapstoneStarter：结业项目最小骨架（第 52 课）。
 * 组合 mock LLM + 工具 + JSON-RPC 入口，可从这里扩展成三选一项目。
 */
import type { LlmClient } from './types.ts'
import { JsonRpcServer } from './jsonrpc.ts'

export interface StarterDeps {
  llm: LlmClient
}

export class CapstoneHarness {
  private readonly rpc: JsonRpcServer

  constructor(private readonly deps: StarterDeps) {
    this.rpc = new JsonRpcServer({
      run: async (params) => {
        const prompt = String(params?.prompt ?? '')
        const reply = await this.deps.llm.chat([{ role: 'user', content: prompt }])
        return reply.content
      },
      ping: async () => 'pong',
    })
  }

  handle(line: string): Promise<string> {
    return this.rpc.handleLine(line)
  }
}
