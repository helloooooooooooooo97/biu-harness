/**
 * mini-dsh CLI：真正基于 @deepseek-ai/cordis 的集成。
 *
 * 所有能力都是 cordis 插件（声明 inject/provide/apply）。注册表插件只提供服务；
 * 工具 / section / skill 等贡献经 ctx.effect 记账，卸载时逆序撤销。
 * boot 只做「根上挂 durable state + 按配置装载插件树」。
 */
import { readFileSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import { expandIncludes, parseEntries } from '@mini-dsh/config'
import { JsonRpcServer } from '@mini-dsh/entrypoints'
import { BenchmarkRunner, type BenchmarkReport } from '@mini-dsh/benchmark'
import { Orchestrator } from '@mini-dsh/workflow'
import { CordisPluginManager } from './plugin-manager.ts'
import { DEFAULT_CONFIG, listPluginFiles, loadAllPlugins, loadPluginModule } from './plugin-registry.ts'

export { DEFAULT_CONFIG, DEFAULT_ENTRIES } from './plugin-registry.ts'

export interface MiniDshApp {
  ctx: Context
  pluginManager: CordisPluginManager
  pluginNames(): string[]
  ready(): Promise<void>
  runHeadless(prompt: string): Promise<{ reply: string; steps: number; events: string[] }>
  rpc(): JsonRpcServer
  runBenchmark(task: string, times: number): Promise<BenchmarkReport>
  runWorkflow(plan: Array<{ id: string; prompt: string; deps?: string[] }>): Promise<Map<string, string>>
}

export function boot(configText: string = DEFAULT_CONFIG, files?: Map<string, string>, vars?: Record<string, unknown>): MiniDshApp {
  const ctx = new Context()
  ctx.provide('state', new Map<string, unknown>())
  const pluginManager = new CordisPluginManager(ctx, undefined, (name, bust) => loadPluginModule(name, bust))
  const entries = expandIncludes(parseEntries(configText), files ?? new Map(), vars ?? { cwd: process.cwd() })
  const bootReady = loadAllPlugins()
    .then((all) => {
      pluginManager.adoptRegistry(all)
      return pluginManager.applyConfig(entries)
    })
  const ready = () => bootReady
  const app: MiniDshApp = {
    ctx,
    pluginManager,
    pluginNames: () => pluginManager.pluginNames(),
    ready,
    runHeadless: async (prompt) => {
      await ready()
      return (ctx.get('headless') as { run(p: string): Promise<{ reply: string; steps: number; events: string[] }> }).run(prompt)
    },
    rpc: () => ctx.get('rpc') as JsonRpcServer,
    runBenchmark: async (task, times) => {
      const runner = new BenchmarkRunner()
      return runner.report(await runner.run(task, () => app.runHeadless(task).then((r) => ({ content: r.reply })), times))
    },
    runWorkflow: async (plan) => {
      await ready()
      return (ctx.get('workflow') as Orchestrator).run(plan.map((t) => ({ ...t, provider: 'inprocess' })))
    },
  }
  return app
}

const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href
if (isMain) {
  const args = process.argv.slice(2)
  if (args[0] === '--config' && args[1]) {
    const app = boot(readFileSync(args[1], 'utf8'))
    const next = args.slice(2)
    runCli(app, next)
  } else if (args[0] === '--watch' && args[1]) {
    const file = args[1]
    const app = boot(readFileSync(file, 'utf8'))
    app.ready().then(() => {
      console.log(`== 插件树 ==\n${app.pluginNames().join(', ')}\n（监听 ${file} 与 plugins/ 目录，改动即热更新）`)
      app.pluginManager.watchConfig(() => readFileSync(file, 'utf8'))
      app.pluginManager.watchPlugins(() => listPluginFiles())
    })
  } else {
    runCli(boot(), args)
  }
}

function runCli(app: MiniDshApp, args: string[]): void {
  if (args[0] === '--rpc') {
    app.ready().then(() => {
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
    })
  } else if (args[0] === '--benchmark') {
    app.runBenchmark(args[1] ?? '帮我 echo hi', Number(args[2] ?? 5))
      .then((report) => console.log(JSON.stringify(report, null, 2)))
      .catch((err: unknown) => { console.error(err); process.exitCode = 1 })
  } else {
    app.runHeadless(args[0] ?? '帮我 echo hi')
      .then(({ reply, events }) => console.log(`== cordis 插件树 ==\n${app.pluginNames().join(', ')}\n== 事件 ==\n${events.join(' → ')}\n== 回答 ==\n${reply}`))
      .catch((err: unknown) => { console.error(`✘ ${err instanceof Error ? err.message : String(err)}`); process.exitCode = 1 })
  }
}
