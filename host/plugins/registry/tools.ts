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

export class ToolsService extends Service {
  private tools = new Map<string, ToolSpec>()
  private guards: ToolGuard[] = []

  constructor(ctx: Context) {
    super(ctx, 'tools')
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
    return [...this.tools.values()].map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
  }

  names() {
    return [...this.tools.keys()]
  }

  async invoke(name: string, args: Record<string, unknown> = {}, signal: AbortSignal = new AbortController().signal) {
    let req: ToolRequest = { name, args }
    for (const guard of this.guards) req = await guard(req)
    req = this.ctx.waterfall('tools/pre-execute', req, () => req)
    this.ctx.emit('tools/pre-execute', req)
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
