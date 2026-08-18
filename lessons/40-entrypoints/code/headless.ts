/** HeadlessRunner：一次 prompt → 一个回合 → 最终回答（第 40 课）。 */
import type { LlmClient } from './types.ts'

export interface HeadlessDeps {
  llm: LlmClient
}

export class HeadlessRunner {
  constructor(private readonly deps: HeadlessDeps) {}

  async run(prompt: string): Promise<string> {
    const reply = await this.deps.llm.chat([{ role: 'user', content: prompt }])
    return reply.content
  }
}
