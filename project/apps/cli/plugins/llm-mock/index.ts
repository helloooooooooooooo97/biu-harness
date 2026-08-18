/** llm-mock 插件：提供带遥测/取消包装的 mock 模型客户端。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { FixtureStore, MockLlm } from '@mini-dsh/llm-deepseek'
import { Cancellation, abortable } from '@mini-dsh/cancellation'
import { Telemetry, TokenMeter } from '@mini-dsh/telemetry'
import { estimateTokens as estimateTextTokens } from '@mini-dsh/compaction'
import type { AssistantReply, ChatMessage, LlmClient } from '@mini-dsh/llm'

export const plugin: Plugin<unknown> = {
  name: 'llm-mock',
  provide: 'llm',
  inject: ['cancel', 'meter', 'telemetry'],
  apply(ctx: Context) {
    const raw = new MockLlm(new FixtureStore([
      { key: '帮我 echo hi', content: '我来执行。', toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"hi"}' }] },
      { key: '帮我 echo hi', content: '结果是 hi。' },
    ]), '[mock] 请换一个有 fixture 的任务。')
    const traced: LlmClient = {
      async chat(messages: ChatMessage[]): Promise<AssistantReply> {
        const reply = await abortable(raw.chat(messages), (ctx.get('cancel') as Cancellation).signal)
        const promptTokens = estimateTextTokens(JSON.stringify(messages))
        const completionTokens = estimateTextTokens(reply.content)
        const meter = ctx.get('meter') as TokenMeter
        const telemetry = ctx.get('telemetry') as Telemetry
        meter.record({ promptTokens, completionTokens })
        telemetry.record('llm/chat', { promptTokens, completionTokens })
        return reply
      },
    }
    ctx.provide('llm', traced)
  },
}
