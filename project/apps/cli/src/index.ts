/**
 * mini-dsh CLI：把全部包串成一个可运行 harness。
 *
 * 链路：配置(36-37) → 服务(插件装载) → 凭据/配方(38-39) → 带遥测/取消/守卫的 loop
 *       → Skills(41) → headless + JSON-RPC 入口(40) → 子代理/workflow(49-50) → benchmark(53)
 */
import { readFile, writeFile } from 'node:fs/promises'
import { ConfigLoader, type PluginDef } from '@mini-dsh/config'
import { CredentialsStore, redactSecrets } from '@mini-dsh/credentials'
import { PresetRegistry } from '@mini-dsh/presets'
import { JsonRpcServer } from '@mini-dsh/entrypoints'
import { SkillRegistry, SkillTool, type SkillProvider } from '@mini-dsh/skills'
import { Telemetry, TokenMeter, CostCalculator } from '@mini-dsh/telemetry'
import { Cancellation, abortable } from '@mini-dsh/cancellation'
import { CompactionRunner, estimateTokens, PressureMonitor } from '@mini-dsh/compaction'
import { SessionLog } from '@mini-dsh/core-session'
import { EchoTool, MemoryTools } from '@mini-dsh/core-tools'
import { WorkspaceGuard, guardFs } from '@mini-dsh/guard'
import { FixtureStore, MockLlm } from '@mini-dsh/llm-deepseek'
import { SECTION_ORDER, SystemPromptAssembler } from '@mini-dsh/core-system-prompt'
import { TurnRunner, PreStepBus, Agent } from '@mini-dsh/core-agent-loop'
import { InProcessProvider, SubagentRegistry } from '@mini-dsh/subagent'
import { Orchestrator } from '@mini-dsh/workflow'
import { BenchmarkRunner, type BenchmarkReport } from '@mini-dsh/benchmark'
import type { AssistantReply, ChatMessage, LlmClient } from '@mini-dsh/llm'

export interface MiniDshApp {
  session: SessionLog
  tools: MemoryTools
  llm: LlmClient
  telemetry: Telemetry
  meter: TokenMeter
  cancel: Cancellation
  skills: SkillRegistry
  presets: PresetRegistry
  prompt: SystemPromptAssembler
  credentials: CredentialsStore
  rpc: JsonRpcServer
  runHeadless(prompt: string): Promise<{ reply: string; steps: number; events: string[] }>
  runBenchmark(task: string, times: number): Promise<BenchmarkReport>
  runWorkflow(plan: Array<{ id: string; prompt: string; deps?: string[] }>): Promise<Map<string, string>>
}

const DEFAULT_CONFIG = JSON.stringify({
  entries: [
    { id: 'llm', name: 'llm-mock' },
    { id: 'tools', name: 'tools' },
    { id: 'prompt', name: 'prompt' },
    { id: 'skills', name: 'skills' },
    { id: 'presets', name: 'presets' },
  ],
})

export function createMiniDsh(configText: string = DEFAULT_CONFIG): MiniDshApp {
  // ---------- 基础服务 ----------
  const session = new SessionLog()
  const tools = new MemoryTools()
  tools.register(new EchoTool())
  const store = new FixtureStore([
    { key: '帮我 echo hi', content: '我来执行。', toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"hi"}' }] },
    { key: '帮我 echo hi', content: '结果是 hi。' },
  ])
  const mock = new MockLlm(store, '[mock] 收到：请换一个我有 fixture 的任务。')
  const telemetry = new Telemetry()
  const meter = new TokenMeter()
  const cancel = new Cancellation()
  const credentials = new CredentialsStore()
  const prompt = new SystemPromptAssembler()
  prompt.section({ name: 'identity', order: SECTION_ORDER.HARNESS_IDENTITY, text: '你是 mini-dsh。' })
  prompt.section({ name: 'tools', order: SECTION_ORDER.TOOL_GUIDANCE, text: '- echo\n- skill' })

  // ---------- Skills（41）----------
  const skills = new SkillRegistry()
  skills.register({
    list: async () => [{ name: 'code-style', description: '代码风格规范' }],
    load: async (name) => (name === 'code-style' ? '两空格缩进，使用 const。' : undefined),
  } satisfies SkillProvider)
  tools.register(new SkillTool(skills))

  // ---------- 配方（39）----------
  const presets = new PresetRegistry({ name: 'default', tools: ['echo', 'skill'] })
  presets.register({ name: 'coding', tools: ['echo', 'bash', 'skill'] })

  // ---------- 带遥测/取消/守卫的 LLM 包装 ----------
  const tracedLlm: LlmClient = {
    async chat(messages: ChatMessage[]): Promise<AssistantReply> {
      const reply = await abortable(mock.chat(messages), cancel.signal)
      const usage = { promptTokens: estimateTokens(JSON.stringify(messages)), completionTokens: estimateTokens(reply.content) }
      meter.record(usage)
      telemetry.record('llm/chat', usage)
      return reply
    },
  }

  // ---------- 工作区守卫（44）----------
  const guard = new WorkspaceGuard(process.cwd())
  const guardedFs = guardFs({
    readFile: (path) => readFile(path, 'utf8'),
    writeFile,
  }, guard)
  tools.register({
    name: 'write_file',
    description: '写入文件（限工作区内）',
    async execute(args) {
      await guardedFs.writeFile(String(args.path ?? ''), String(args.content ?? ''))
      return 'ok'
    },
  })

  // ---------- 配置驱动加载（36-37）----------
  const registry = new Map<string, PluginDef>([
    ['llm-mock', { name: 'llm-mock', apply(c) { c.provide('llm', tracedLlm) } }],
    ['tools', { name: 'tools', apply(c) { c.provide('tools', tools) } }],
    ['prompt', { name: 'prompt', apply(c) { c.provide('prompt', prompt) } }],
    ['skills', { name: 'skills', apply(c) { c.provide('skills', skills) } }],
    ['presets', { name: 'presets', apply(c) { c.provide('presets', presets) } }],
  ])
  const loader = new ConfigLoader({ registry, vars: { cwd: process.cwd() } })
  loader.load(configText)

  // ---------- loop（22-25）+ 压缩（46）----------
  const compression = new CompactionRunner(new PressureMonitor(2000))
  const turn = new TurnRunner({ llm: tracedLlm, session, tools })
  const pre = new PreStepBus()
  const agent = new Agent('main')

  // ---------- 子代理与工作流（49-50）----------
  const subagents = new SubagentRegistry()
  subagents.register(new InProcessProvider(tracedLlm))
  const orchestrator = new Orchestrator(subagents)

  // ---------- 入口（40）----------
  const rpc = new JsonRpcServer({
    ping: async () => 'pong',
    status: async () => ({ events: telemetry.query().length, tokens: meter.get(), cost: new CostCalculator({ promptPerM: 1, completionPerM: 2 }).cost(meter.get()) }),
    run: async (params) => (await app.runHeadless(String(params?.prompt ?? ''))).reply,
    workflow: async (params) => {
      const plan = (params?.tasks as Array<{ id: string; prompt: string; deps?: string[] }> | undefined) ?? []
      return [...(await app.runWorkflow(plan)).entries()]
    },
  })

  const app: MiniDshApp = {
    session,
    tools,
    llm: tracedLlm,
    telemetry,
    meter,
    cancel,
    skills,
    presets,
    prompt,
    credentials,
    rpc,
    async runHeadless(input) {
      const start = Date.now()
      agent.followup(input)
      const { turnInput } = agent.inbox.claimNextTurn()
      const entered = turnInput?.content ?? input
      const decision = pre.run({ messages: [{ id: 'm1', content: entered }], turn: 1, step: 1 })
      const promptText = decision.kind === 'enter' ? decision.messages[0].content : entered
      const compacted = compression.compact(session.all.map((e) => ({ role: e.kind.startsWith('user') ? 'user' : 'assistant', content: JSON.stringify(e.data) })))
      for (const event of compacted.events) telemetry.record(event.kind, event.data)
      const result = await turn.run(promptText)
      telemetry.record('agent/run', { steps: result.steps, durationMs: Date.now() - start, reply: redactSecrets(result.reply, credentials.all().map(([, v]) => v)) })
      agent.settle()
      return { reply: result.reply, steps: result.steps, events: session.all.map((e) => e.kind) }
    },
    runBenchmark: (task, times) => new BenchmarkRunner().run(task, () => app.runHeadless(task).then((r) => ({ content: r.reply })), times).then((runs) => new BenchmarkRunner().report(runs)),
    runWorkflow: (plan) => orchestrator.run(plan.map((t) => ({ ...t, provider: 'inprocess' }))),
  }
  return app
}

const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href
if (isMain) {
  const args = process.argv.slice(2)
  const app = createMiniDsh()
  if (args[0] === '--rpc') {
    process.stdin.setEncoding('utf8')
    let buffer = ''
    process.stdin.on('data', async (chunk) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        process.stdout.write(`${await app.rpc.handleLine(line)}\n`)
      }
    })
  } else if (args[0] === '--benchmark') {
    app.runBenchmark(args[1] ?? '帮我 echo hi', Number(args[2] ?? 5))
      .then((report) => console.log(JSON.stringify(report, null, 2)))
      .catch((err) => { console.error(err); process.exitCode = 1 })
  } else {
    const prompt = args[0] ?? '帮我 echo hi'
    app.runHeadless(prompt)
      .then(({ reply, events }) => {
        console.log(`== 事件 ==\n${events.join(' → ')}\n== 回答 ==\n${reply}`)
      })
      .catch((err: unknown) => {
        console.error(`✘ ${err instanceof Error ? err.message : String(err)}`)
        process.exitCode = 1
      })
  }
}
