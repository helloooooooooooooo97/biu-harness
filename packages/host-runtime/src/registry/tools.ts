import { AsyncLocalStorage } from 'node:async_hooks'
import { Service, type Context } from 'cordis'
import '../../types.ts'

export interface ToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>, signal: AbortSignal) => unknown | Promise<unknown>
}

export interface ToolCatalogItem {
  name: string
  description: string
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

/** 本回合 slash 选中的额外工具（极简模式下临时放开）。 */
const extraToolsStorage = new AsyncLocalStorage<ReadonlySet<string>>()

/** 回合级工具策略（会话 config 覆盖全局 mode/extras）。 */
const toolPolicyStorage = new AsyncLocalStorage<{
  mode: AgentToolMode
  extras: ReadonlySet<string>
}>()

export function runWithExtraTools<T>(names: readonly string[], fn: () => T): T {
  const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  return extraToolsStorage.run(new Set(cleaned), fn)
}

export function runWithToolPolicy<T>(
  policy: { mode: AgentToolMode; extras?: readonly string[] },
  fn: () => T,
): T {
  const extras = [...new Set((policy.extras ?? []).map((n) => n.trim()).filter(Boolean))]
  return toolPolicyStorage.run({ mode: policy.mode, extras: new Set(extras) }, () =>
    runWithExtraTools(extras, fn),
  )
}

export class ToolsService extends Service {
  private tools = new Map<string, ToolSpec>()
  private guards: ToolGuard[] = []
  private mode: AgentToolMode = 'standard'
  /** 极简模式下常驻额外工具（配置面板勾选，跨回合生效）。 */
  private pinnedExtras: string[] = []

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

  getPinnedExtras() {
    return [...this.pinnedExtras]
  }

  setPinnedExtras(names: readonly string[]) {
    const liveSet = new Set<string>([
      'session_list',
      'session_inspect',
      'session_progress',
      'session_wake',
      'session_inject',
      'session_create',
      'session_rename',
      'session_configure',
      'session_delete',
    ])
    const cleaned = [
      ...new Set(
        names
          .map((name) => name.trim())
          .filter(Boolean)
          .filter((name) => !(MINIMAL_TOOL_NAMES as readonly string[]).includes(name))
          .filter((name) => !liveSet.has(name)),
      ),
    ]
    const same =
      cleaned.length === this.pinnedExtras.length && cleaned.every((name, i) => name === this.pinnedExtras[i])
    if (same) return
    this.pinnedExtras = cleaned
    this.ctx.emit('hub/change')
  }

  private visible(name: string) {
    const policy = toolPolicyStorage.getStore()
    const mode = policy?.mode ?? this.mode
    if (mode === 'standard') return true
    if ((MINIMAL_TOOL_NAMES as readonly string[]).includes(name)) return true
    if ((policy?.extras ?? new Set()).has(name)) return true
    if (!policy && this.pinnedExtras.includes(name)) return true
    return extraToolsStorage.getStore()?.has(name) ?? false
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

  /** 全量目录（不受 mode 过滤），供 slash 菜单。 */
  catalog(): ToolCatalogItem[] {
    return [...this.tools.values()]
      .map((tool) => ({ name: tool.name, description: tool.description }))
      .sort((a, b) => a.name.localeCompare(b.name))
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
