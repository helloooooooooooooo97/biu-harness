/** 模型面 cordis 工具集：inspect/define/run/stop/undefine（第 43 课）。 */
import type { DynamicHost } from './dynamic-host.ts'

export class CordisToolset {
  constructor(private readonly host: DynamicHost) {}

  async execute(action: string, args: Record<string, unknown>): Promise<string> {
    switch (action) {
      case 'inspect': {
        const list = this.host.inspect()
        return list.map((d) => `- ${d.id} ${d.name} (${d.running ? 'running' : 'idle'})`).join('\n') || '(无动态插件)'
      }
      case 'define':
        return this.host.define({ name: String(args.name ?? ''), purpose: String(args.purpose ?? ''), host: args.host ? String(args.host) : undefined, client: args.client ? String(args.client) : undefined })
      case 'run': {
        const result = await this.host.run(String(args.id ?? ''))
        return result.ok ? 'ok' : `拒绝: ${result.reason}`
      }
      case 'stop':
        this.host.stop(String(args.id ?? ''))
        return 'stopped'
      case 'undefine':
        this.host.undefine(String(args.id ?? ''))
        return 'undefined'
      default:
        return `未知动作: ${action}`
    }
  }
}
