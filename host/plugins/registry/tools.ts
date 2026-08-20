import { Service, type Context } from 'cordis'
import '../../types.ts'

export interface ToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>, signal: AbortSignal) => unknown | Promise<unknown>
}

export interface ToolRequest {
  name: string
  args: Record<string, unknown>
  deny?: string
}

export type ToolGuard = (req: ToolRequest) => ToolRequest | Promise<ToolRequest>

/** 对齐 dsh：standard 暴露全部已注册工具；minimal 仅 bash + str_replace_editor。 */
export type AgentToolMode = 'standard' | 'minimal'

export const MINIMAL_TOOL_NAMES = ['bash', 'str_replace_editor'] as const

export class ToolsService extends Service {
  private tools = new Map<string, ToolSpec>()
  private guards: ToolGuard[] = []
  private mode: AgentToolMode = 'standard'

  constructor(ctx: Context) {
    super(ctx, 'tools')
  }

  getMode() {
    return this.mode
  }

  setMode(mode: AgentToolMode) {
    if (mode !== 'standard' && mode !== 'minimal') throw new Error(`unknown agent tool mode: ${mode}`)
    if (this.mode === mode) return
    this.mode = mode
    this.ctx.emit('hub/change')
  }

  private visible(name: string) {
    if (this.mode === 'standard') return true
    return (MINIMAL_TOOL_NAMES as readonly string[]).includes(name)
  }

  register(spec: ToolSpec) {
    return this.ctx.effect(() => {
      if (this.tools.has(spec.name)) throw new Error(`tool already registered: ${spec.name}`)
      this.tools.set(spec.name, spec)
      this.ctx.emit('hub/change')
      return () => {
        this.tools.delete(spec.name)
        this.ctx.emit('hub/change')
      }
    }, `tools.register ${spec.name}`)
  }

  guard(fn: ToolGuard) {
    return this.ctx.effect(() => {
      this.guards.push(fn)
      return () => {
        this.guards = this.guards.filter((item) => item !== fn)
      }
    }, 'tools.guard')
  }

  schemas() {
    return [...this.tools.values()]
      .filter((tool) => this.visible(tool.name))
      .map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }))
  }

  names() {
    return [...this.tools.keys()].filter((name) => this.visible(name))
  }

  async invoke(name: string, args: Record<string, unknown> = {}, signal: AbortSignal = new AbortController().signal) {
    if (!this.visible(name)) {
      throw new Error(`tool not available in ${this.mode} mode: ${name}`)
    }
    let req: ToolRequest = { name, args }
    for (const guard of this.guards) req = await guard(req)
    req = this.ctx.waterfall('tools/pre-execute', req, () => req)
    if (req.deny) {
      this.ctx.emit('tools/post-execute', { name, ok: false, detail: req.deny })
      throw new Error(req.deny)
    }
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`unknown tool: ${name}`)
    try {
      const result = await tool.execute(req.args, signal)
      this.ctx.emit('tools/post-execute', { name, ok: true, detail: stringify(result) })
      return result
    } catch (error) {
      this.ctx.emit('tools/post-execute', { name, ok: false, detail: String(error) })
      throw error
    }
  }
}

function stringify(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const name = 'tools'
export const inject = [] as const

export function apply(ctx: Context) {
  new ToolsService(ctx)
}
