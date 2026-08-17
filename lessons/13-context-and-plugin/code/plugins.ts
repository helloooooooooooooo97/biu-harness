/**
 * 演示插件：sections / tools / prompt / ui——全部以插件形式注册能力。
 */
import type { Context, PluginDef } from './context.ts'

export interface ToolsService {
  register(name: string, executor: (args: Record<string, unknown>) => Promise<string>): () => void
  list(): string[]
  execute(name: string, args: Record<string, unknown>): Promise<string>
}

export interface UiService {
  registerComponent(key: string, component: unknown): () => void
  listComponents(): string[]
}

/** 提供共享 sections 数组服务。 */
export const sectionsPlugin: PluginDef = {
  name: 'sections',
  apply(ctx) {
    const sections: string[] = []
    ctx.provide('sections', sections)
  },
}

/** 提供工具注册表服务；每个注册都是可逆 effect。 */
export const toolsPlugin: PluginDef = {
  name: 'tools',
  apply(ctx) {
    const tools = new Map<string, (args: Record<string, unknown>) => Promise<string>>()
    ctx.provide('tools', {
      register(name, executor) {
        if (tools.has(name)) throw new Error(`工具已存在: ${name}`)
        tools.set(name, executor)
        return ctx.effect(() => tools.delete(name))
      },
      list() {
        return [...tools.keys()]
      },
      async execute(name, args) {
        const fn = tools.get(name)
        if (!fn) throw new Error(`未知工具: ${name}`)
        return fn(args)
      },
    } satisfies ToolsService)
    return () => tools.clear()
  },
}

/** 往 sections 里注册一段系统提示词；卸载时移除自己的贡献。 */
export const promptPlugin: PluginDef = {
  name: 'prompt',
  apply(ctx) {
    const sections = ctx.get<string[]>('sections')
    const section = '- 可用工具：由 tools 插件注册'
    sections.push(section)
    return () => {
      const index = sections.indexOf(section)
      if (index >= 0) sections.splice(index, 1)
    }
  },
}

/** 提供 UI 组件注册表服务。 */
export const uiPlugin: PluginDef = {
  name: 'ui',
  apply(ctx) {
    const components = new Map<string, unknown>()
    ctx.provide('ui', {
      registerComponent(key, component) {
        if (components.has(key)) throw new Error(`组件已存在: ${key}`)
        components.set(key, component)
        return ctx.effect(() => components.delete(key))
      },
      listComponents() {
        return [...components.keys()]
      },
    } satisfies UiService)
    return () => components.clear()
  },
}
