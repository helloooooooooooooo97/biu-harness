/** 内置插件注册表：配置里的 name → PluginDef。 */
import type { PluginDef } from './plugin-host.ts'

export const BUILTIN_PLUGINS: Map<string, PluginDef> = new Map([
  ['tools', {
    name: 'tools',
    apply(ctx) {
      ctx.provide('tools', { list: () => ['bash', 'echo'] })
    },
  }],
  ['prompt', {
    name: 'prompt',
    apply(ctx) {
      ctx.provide('prompt', { section: '- 可用工具由 tools 插件提供' })
    },
  }],
  ['logger', {
    name: 'logger',
    apply(ctx) {
      ctx.provide('logger', { log: (msg: string) => msg })
    },
  }],
])
