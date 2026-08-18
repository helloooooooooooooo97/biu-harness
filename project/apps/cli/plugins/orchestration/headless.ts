/** [orchestration] headless：编排插件——提供无头运行入口（编排 loop + 会话 + 遥测 + 压缩）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { SessionLog } from '@mini-dsh/core-session'
import { Telemetry } from '@mini-dsh/telemetry'
import { CompactionRunner } from '@mini-dsh/compaction'
import { CredentialsStore, redactSecrets } from '@mini-dsh/credentials'

export const plugin: Plugin<unknown> = {
  name: 'headless',
  provide: 'headless',
  inject: ['agentLoop', 'session', 'telemetry', 'compaction'],
  apply(ctx: Context) {
    const loop = ctx.get('agentLoop') as { run(p: string): Promise<{ reply: string; steps: number }> }
    const session = ctx.get('session') as SessionLog
    const telemetry = ctx.get('telemetry') as Telemetry
    const compaction = ctx.get('compaction') as CompactionRunner
    const credentials = new CredentialsStore()
    ctx.provide('headless', {
      async run(input: string) {
        const start = Date.now()
        const compacted = compaction.compact(session.all.map((e) => ({ role: e.kind.startsWith('user') ? 'user' : 'assistant', content: JSON.stringify(e.data) })))
        for (const event of compacted.events) telemetry.record(event.kind, event.data)
        const result = await loop.run(input)
        telemetry.record('agent/run', { steps: result.steps, durationMs: Date.now() - start, reply: redactSecrets(result.reply, credentials.all().map(([, v]) => v)) })
        return { reply: result.reply, steps: result.steps, events: session.all.map((e) => e.kind) }
      },
    })
  },
}
