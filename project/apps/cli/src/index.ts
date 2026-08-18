/**
 * mini-dsh CLI：真正"一切皆插件"的集成。
 *
 * 每个能力都是一个插件（含 agent loop 本身）：session / llm-mock / tools / guard /
 * prompt / skills / presets / telemetry / cancellation / compaction / subagents /
 * workflow / agent-loop / headless / rpc。app 只是"按配置装载插件树 + 消费能力"。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { CapabilityContext, type PluginDef } from '@mini-dsh/core-capability'
import { evalJs, expandIncludes, parseEntries } from '@mini-dsh/config'
import { CredentialsStore, redactSecrets } from '@mini-dsh/credentials'
import { PresetRegistry } from '@mini-dsh/presets'
import { JsonRpcServer } from '@mini-dsh/entrypoints'
import { SkillRegistry, SkillTool, type SkillProvider } from '@mini-dsh/skills'
import { CostCalculator, Telemetry, TokenMeter } from '@mini-dsh/telemetry'
import { Cancellation, abortable } from '@mini-dsh/cancellation'
import { CompactionRunner, estimateTokens, PressureMonitor } from '@mini-dsh/compaction'
import { SessionLog } from '@mini-dsh/core-session'
import { EchoTool, MemoryTools } from '@mini-dsh/core-tools'
import { WorkspaceGuard, guardFs } from '@mini-dsh/guard'
import { FixtureStore, MockLlm } from '@mini-dsh/llm-deepseek'
import { SECTION_ORDER, SystemPromptAssembler } from '@mini-dsh/core-system-prompt'
import { TurnRunner } from '@mini-dsh/core-agent-loop'
import { InProcessProvider, SubagentRegistry } from '@mini-dsh/subagent'
import { Orchestrator } from '@mini-dsh/workflow'
import { BenchmarkRunner, type BenchmarkReport } from '@mini-dsh/benchmark'
import type { AssistantReply, ChatMessage, LlmClient } from '@mini-dsh/llm'

export interface MiniDshApp {
  ctx: CapabilityContext
  pluginNames(): string[]
  runHeadless(prompt: string): Promise<{ reply: string; steps: number; events: string[] }>
  rpc(): JsonRpcServer
  runBenchmark(task: string, times: number): Promise<BenchmarkReport>
  runWorkflow(plan: Array<{ id: string; prompt: string; deps?: string[] }>): Promise<Map<string, string>>
}

export const DEFAULT_CONFIG = JSON.stringify({
  entries: [
    { id: 's', name: 'session' },
    { id: 'llm', name: 'llm-mock' },
    { id: 'g', name: 'guard' },
    { id: 't', name: 'tools' },
    { id: 'p', name: 'prompt' },
    { id: 'sk', name: 'skills' },
    { id: 'pr', name: 'presets' },
    { id: 'tel', name: 'telemetry' },
    { id: 'cn', name: 'cancellation' },
    { id: 'cp', name: 'compaction' },
    { id: 'sa', name: 'subagents' },
    { id: 'wf', name: 'workflow' },
    { id: 'loop', name: 'agent-loop' },
    { id: 'h', name: 'headless' },
    { id: 'rpc', name: 'rpc' },
  ],
})

/** 插件注册表：每个能力 = 一个插件（CapabilityContext.mount 懒创建 + 可替换）。 */
export function pluginRegistry(ctx: CapabilityContext): Map<string, PluginDef> {
  const c = ctx as CapabilityContext
  return new Map<string, PluginDef>([
    ['session', {
      name: 'session',
      apply(cc) {
        cc.mount({ definition: { key: 'session', description: '会话日志' }, create: () => new SessionLog() })
      },
    }],
    ['llm-mock', {
      name: 'llm-mock',
      apply(cc) {
        cc.mount({
          definition: { key: 'llm', description: 'mock LLM' },
          create: () => {
            const raw = new MockLlm(new FixtureStore([
              { key: '帮我 echo hi', content: '我来执行。', toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"hi"}' }] },
              { key: '帮我 echo hi', content: '结果是 hi。' },
            ]), '[mock] 请换一个有 fixture 的任务。')
            return {
              async chat(messages: ChatMessage[]): Promise<AssistantReply> {
                const reply = await abortable(raw.chat(messages), c.get<Cancellation>('cancel').signal)
                const usage = { promptTokens: estimateTokens(JSON.stringify(messages)), completionTokens: estimateTokens(reply.content) }
                c.get<TokenMeter>('meter').record(usage)
                c.get<Telemetry>('telemetry').record('llm/chat', usage)
                return reply
              },
            } satisfies LlmClient
          },
        })
      },
    }],
    ['guard', {
      name: 'guard',
      apply(cc) {
        cc.mount({ definition: { key: 'guard', description: '工作区守卫' }, create: () => new WorkspaceGuard(process.cwd()) })
      },
    }],
    ['tools', {
      name: 'tools',
      apply(cc) {
        cc.mount({
          definition: { key: 'tools', description: '工具注册表' },
          create: () => {
            const tools = new MemoryTools()
            tools.register(new EchoTool())
            tools.register(new SkillTool(c.get<SkillRegistry>('skills')))
            tools.register({
              name: 'write_file',
              description: '写入文件（限工作区内）',
              async execute(args) {
                const fs = guardFs({ readFile: (p) => readFile(p, 'utf8'), writeFile }, c.get<WorkspaceGuard>('guard'))
                await fs.writeFile(String(args.path ?? ''), String(args.content ?? ''))
                return 'ok'
              },
            })
            return tools
          },
        })
      },
    }],
    ['prompt', {
      name: 'prompt',
      apply(cc) {
        cc.mount({
          definition: { key: 'prompt', description: '系统提示词' },
          create: () => {
            const prompt = new SystemPromptAssembler()
            prompt.section({ name: 'identity', order: SECTION_ORDER.HARNESS_IDENTITY, text: '你是 mini-dsh。' })
            prompt.section({ name: 'tools', order: SECTION_ORDER.TOOL_GUIDANCE, text: '- echo\n- skill' })
            return prompt
          },
        })
      },
    }],
    ['skills', {
      name: 'skills',
      apply(cc) {
        cc.mount({
          definition: { key: 'skills', description: '技能注册表' },
          create: () => {
            const skills = new SkillRegistry()
            skills.register({
              list: async () => [{ name: 'code-style', description: '代码风格规范' }],
              load: async (name) => (name === 'code-style' ? '两空格缩进，使用 const。' : undefined),
            } satisfies SkillProvider)
            return skills
          },
        })
      },
    }],
    ['presets', {
      name: 'presets',
      apply(cc) {
        cc.mount({
          definition: { key: 'presets', description: '能力配方' },
          create: () => {
            const presets = new PresetRegistry({ name: 'default', tools: ['echo', 'skill'] })
            presets.register({ name: 'coding', tools: ['echo', 'bash', 'skill'] })
            return presets
          },
        })
      },
    }],
    ['telemetry', {
      name: 'telemetry',
      apply(cc) {
        cc.mount({ definition: { key: 'telemetry', description: '遥测' }, create: () => new Telemetry() })
        cc.mount({ definition: { key: 'meter', description: 'token 记账' }, create: () => new TokenMeter() })
        cc.mount({ definition: { key: 'cost', description: '成本' }, create: () => new CostCalculator({ promptPerM: 1, completionPerM: 2 }) })
      },
    }],
    ['cancellation', {
      name: 'cancellation',
      apply(cc) {
        cc.mount({ definition: { key: 'cancel', description: '取消令牌' }, create: () => new Cancellation() })
      },
    }],
    ['compaction', {
      name: 'compaction',
      apply(cc) {
        cc.mount({ definition: { key: 'compaction', description: '上下文压缩' }, create: () => new CompactionRunner(new PressureMonitor(2000)) })
      },
    }],
    ['subagents', {
      name: 'subagents',
      apply(cc) {
        cc.mount({
          definition: { key: 'subagents', description: '子代理注册表' },
          create: () => {
            const registry = new SubagentRegistry()
            registry.register(new InProcessProvider(c.get<LlmClient>('llm')))
            return registry
          },
        })
      },
    }],
    ['workflow', {
      name: 'workflow',
      apply(cc) {
        cc.mount({
          definition: { key: 'workflow', description: '多 Agent 编排' },
          create: () => new Orchestrator(c.get<SubagentRegistry>('subagents')),
        })
      },
    }],
    // ---- agent loop 本身也是插件：换 loop = 换配置里的插件 ----
    ['agent-loop', {
      name: 'agent-loop',
      apply(cc) {
        cc.mount({
          definition: { key: 'agentLoop', description: 'loop 驱动（默认）' },
          create: () => new TurnRunner({
            llm: c.get<LlmClient>('llm'),
            session: c.get<SessionLog>('session'),
            tools: c.get<MemoryTools>('tools'),
          }),
        })
      },
    }],
    ['agent-loop-v2', {
      name: 'agent-loop-v2',
      apply(cc) {
        cc.mount({
          definition: { key: 'agentLoop', description: 'loop 驱动（v2 直答）' },
          create: () => ({
            async run(prompt: string) {
              return { turn: 1, steps: 1, reply: `[loop-v2] ${prompt}` }
            },
          }),
        })
      },
    }],
    ['headless', {
      name: 'headless',
      apply(cc) {
        cc.mount({
          definition: { key: 'headless', description: 'headless 入口' },
          create: () => {
            const loop = c.get<{ run(p: string): Promise<{ reply: string; steps: number }> }>('agentLoop')
            const session = c.get<SessionLog>('session')
            const telemetry = c.get<Telemetry>('telemetry')
            const compaction = c.get<CompactionRunner>('compaction')
            const credentials = new CredentialsStore()
            return {
              async run(input: string) {
                const start = Date.now()
                const compacted = compaction.compact(session.all.map((e) => ({ role: e.kind.startsWith('user') ? 'user' : 'assistant', content: JSON.stringify(e.data) })))
                for (const event of compacted.events) telemetry.record(event.kind, event.data)
                const result = await loop.run(input)
                telemetry.record('agent/run', { steps: result.steps, durationMs: Date.now() - start, reply: redactSecrets(result.reply, credentials.all().map(([, v]) => v)) })
                return { reply: result.reply, steps: result.steps, events: session.all.map((e) => e.kind) }
              },
            }
          },
        })
      },
    }],
    ['rpc', {
      name: 'rpc',
      apply(cc) {
        cc.mount({
          definition: { key: 'rpc', description: 'JSON-RPC 入口' },
          create: () => {
            const headless = c.get<{ run(p: string): Promise<{ reply: string }> }>('headless')
            const workflow = c.get<Orchestrator>('workflow')
            const telemetry = c.get<Telemetry>('telemetry')
            const meter = c.get<TokenMeter>('meter')
            const cost = c.get<CostCalculator>('cost')
            return new JsonRpcServer({
              ping: async () => 'pong',
              status: async () => ({ events: telemetry.query().length, tokens: meter.get(), cost: cost.cost(meter.get()) }),
              run: async (params) => (await headless.run(String(params?.prompt ?? ''))).reply,
              workflow: async (params) => [...(await workflow.run(((params?.tasks as Array<{ id: string; prompt: string; deps?: string[] }>) ?? []).map((t) => ({ ...t, provider: 'inprocess' })))).entries()],
            })
          },
        })
      },
    }],
  ])
}

export function boot(configText: string = DEFAULT_CONFIG, files?: Map<string, string>, vars?: Record<string, unknown>): MiniDshApp {
  const ctx = new CapabilityContext()
  const registry = pluginRegistry(ctx)
  const entries = expandIncludes(parseEntries(configText), files ?? new Map(), vars ?? { cwd: process.cwd() })
  for (const entry of entries) {
    if (entry.enabled === false) continue
    const def = registry.get(entry.name)
    if (!def) throw new Error(`未知插件: ${entry.name}`)
    ctx.plugin(def)
  }
  const app: MiniDshApp = {
    ctx,
    pluginNames: () => ctx.pluginNames(),
    runHeadless: (prompt) => ctx.get<{ run(p: string): Promise<{ reply: string; steps: number; events: string[] }> }>('headless').run(prompt),
    rpc: () => ctx.get<JsonRpcServer>('rpc'),
    runBenchmark: async (task, times) => {
      const runner = new BenchmarkRunner()
      return runner.report(await runner.run(task, () => app.runHeadless(task).then((r) => ({ content: r.reply })), times))
    },
    runWorkflow: (plan) => ctx.get<Orchestrator>('workflow').run(plan.map((t) => ({ ...t, provider: 'inprocess' }))),
  }
  return app
}

const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href
if (isMain) {
  const args = process.argv.slice(2)
  const app = boot()
  if (args[0] === '--rpc') {
    process.stdin.setEncoding('utf8')
    let buffer = ''
    process.stdin.on('data', async (chunk) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        process.stdout.write(`${await app.rpc().handleLine(line)}\n`)
      }
    })
  } else if (args[0] === '--benchmark') {
    app.runBenchmark(args[1] ?? '帮我 echo hi', Number(args[2] ?? 5))
      .then((report) => console.log(JSON.stringify(report, null, 2)))
      .catch((err: unknown) => { console.error(err); process.exitCode = 1 })
  } else {
    app.runHeadless(args[0] ?? '帮我 echo hi')
      .then(({ reply, events }) => console.log(`== 插件树 ==\n${app.pluginNames().join(', ')}\n== 事件 ==\n${events.join(' → ')}\n== 回答 ==\n${reply}`))
      .catch((err: unknown) => { console.error(`✘ ${err instanceof Error ? err.message : String(err)}`); process.exitCode = 1 })
  }
}
