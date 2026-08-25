import { Service, type Context } from 'cordis'

export class SystemPromptService extends Service {
  private sections = new Map<string, () => string>()

  constructor(ctx: Context) {
    super(ctx, 'systemPrompt')
  }

  register(id: string, source: string | (() => string)) {
    return this.ctx.effect(() => {
      this.sections.set(id, typeof source === 'string' ? () => source : source)
      return () => this.sections.delete(id)
    }, `systemPrompt.register ${id}`)
  }

  assemble() {
    const parts = [...this.sections.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, source]) => source().trim())
      .filter(Boolean)
    const tools = this.ctx.tools?.names() ?? []
    parts.push(`可用工具会随插件装卸变化：${tools.join(', ') || '（无）'}。没有的工具不要调用。`)
    return parts.join('\n')
  }
}

export const name = 'system-prompt'
export const inject = ['tools']

export function apply(ctx: Context) {
  const prompt = new SystemPromptService(ctx)
  prompt.register('base', '你是控制台里的助手。优先调用已注册 tools 完成操作。回答简洁。')
}
