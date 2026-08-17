/**
 * ToolPipeline：pre → guards → approval → execute → post → finalize → result（第 27 课）。
 */

export interface ToolInvocation {
  callId: string
  name: string
  arguments: Record<string, unknown>
  signal?: AbortSignal
}

export interface PipelineDecision {
  allow: boolean
  reason?: string
}

export interface PipelineResult {
  value: unknown
  text: string
  isError: boolean
  denied?: boolean
}

export interface ApprovalLike {
  ask(question: string): Promise<boolean>
}

type Listener = (...args: any[]) => unknown

class EventBus {
  private readonly listeners = new Map<string, Listener[]>()

  on(kind: string, listener: Listener): () => void {
    const list = this.listeners.get(kind) ?? []
    list.push(listener)
    this.listeners.set(kind, list)
    return () => {
      const index = list.indexOf(listener)
      if (index >= 0) list.splice(index, 1)
    }
  }

  waterfall(kind: string, initial: unknown, ...args: unknown[]): unknown {
    let value = initial
    for (const listener of [...(this.listeners.get(kind) ?? [])]) {
      let delegated = false
      const next = (wrapped: unknown): void => {
        value = wrapped
        delegated = true
      }
      const result = listener(value, ...args, next)
      if (!delegated) return result
    }
    return value
  }

  emit(kind: string, ...args: unknown[]): void {
    for (const listener of [...(this.listeners.get(kind) ?? [])]) listener(...args)
  }
}

export class ToolPipeline {
  private readonly bus = new EventBus()
  private readonly guards: Array<(inv: ToolInvocation) => PipelineDecision> = []
  private approval?: ApprovalLike

  onPre(listener: (decision: PipelineDecision, inv: ToolInvocation, next: (d: PipelineDecision) => void) => PipelineDecision | void): () => void {
    return this.bus.on('tools/pre-execute', listener as Listener)
  }

  addGuard(guard: (inv: ToolInvocation) => PipelineDecision): () => void {
    this.guards.push(guard)
    return () => {
      const index = this.guards.indexOf(guard)
      if (index >= 0) this.guards.splice(index, 1)
    }
  }

  setApproval(approval: ApprovalLike | undefined): void {
    this.approval = approval
  }

  onPost(listener: (text: string, inv: ToolInvocation, next: (t: string) => void) => string | void): () => void {
    return this.bus.on('tools/post-execute', listener as Listener)
  }

  onResult(listener: (result: PipelineResult, inv: ToolInvocation) => void): () => void {
    return this.bus.on('tools/result', listener as Listener)
  }

  async execute(
    inv: ToolInvocation,
    body: (args: Record<string, unknown>) => Promise<unknown>,
    opts: { render?: (value: unknown) => string; finalizeContent?: (text: string) => string } = {},
  ): Promise<PipelineResult> {
    const pre = this.bus.waterfall('tools/pre-execute', { allow: true } satisfies PipelineDecision, inv) as PipelineDecision
    let denied: PipelineDecision | null = pre.allow ? null : pre
    if (!denied) {
      for (const guard of [...this.guards]) {
        const decision = guard(inv)
        if (!decision.allow) {
          denied = decision
          break
        }
      }
    }
    if (!denied && this.approval) {
      const ok = await this.approval.ask(`允许调用工具 ${inv.name}？`)
      if (!ok) denied = { allow: false, reason: '用户拒绝审批' }
    }
    if (denied) {
      const result: PipelineResult = { value: null, text: denied.reason ?? '拒绝', isError: true, denied: true }
      this.bus.emit('tools/result', result, inv)
      return result
    }

    let value: unknown
    let error: unknown
    try {
      value = await body(inv.arguments)
    } catch (err) {
      error = err
    }

    let text = error
      ? `错误: ${error instanceof Error ? error.message : String(error)}`
      : (opts.render?.(value) ?? JSON.stringify(value))
    text = this.bus.waterfall('tools/post-execute', text, inv) as string

    if (opts.finalizeContent && !error) {
      try {
        text = opts.finalizeContent(text)
      } catch (err) {
        error = err
        text = `错误: ${err instanceof Error ? err.message : String(err)}`
      }
    }

    const result: PipelineResult = { value: error ? null : value, text, isError: !!error }
    this.bus.emit('tools/result', result, inv)
    return result
  }
}
