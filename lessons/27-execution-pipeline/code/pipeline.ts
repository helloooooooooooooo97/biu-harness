/**
 * ToolPipeline：pre → guards → approval → execute → post → finalize → result。
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

export interface ExecuteOptions {
  render?: (value: unknown) => string
  finalizeContent?: (text: string) => string
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
    for (const listener of [...(this.listeners.get(kind) ?? [])]) {
      listener(...args)
    }
  }
}

export class ToolPipeline {
  private readonly bus = new EventBus()
  private readonly guards: Array<(inv: ToolInvocation) => PipelineDecision> = []
  private approval?: ApprovalLike

  /** pre-execute 瀑布：监听器可拒绝（短路）或放行。 */
  onPre(listener: (decision: PipelineDecision, inv: ToolInvocation, next: (d: PipelineDecision) => void) => PipelineDecision | void): () => void {
    return this.bus.on('tools/pre-execute', listener as Listener)
  }

  /** 单调 guard：一旦拒绝，后续无法撤销。 */
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

  /** post-execute 瀑布：改写结果文本。 */
  onPost(listener: (text: string, inv: ToolInvocation, next: (t: string) => void) => string | void): () => void {
    return this.bus.on('tools/post-execute', listener as Listener)
  }

  /** tools/result 通知：冻结的权威结果。 */
  onResult(listener: (result: PipelineResult, inv: ToolInvocation) => void): () => void {
    return this.bus.on('tools/result', listener as Listener)
  }

  async execute(inv: ToolInvocation, body: (args: Record<string, unknown>) => Promise<unknown>, opts: ExecuteOptions = {}): Promise<PipelineResult> {
    // 1. pre-execute 瀑布
    const pre = this.bus.waterfall('tools/pre-execute', { allow: true } satisfies PipelineDecision, inv) as PipelineDecision
    // 2. 单调 guard
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
    // 3. 审批
    if (!denied && this.approval) {
      const ok = await this.approval.ask(`允许调用工具 ${inv.name}？`)
      if (!ok) denied = { allow: false, reason: '用户拒绝审批' }
    }
    if (denied) {
      const result: PipelineResult = { value: null, text: denied.reason ?? '拒绝', isError: true, denied: true }
      this.notify(inv, result)
      return result
    }

    // 4. 执行
    let value: unknown
    let error: unknown
    try {
      value = await body(inv.arguments)
    } catch (err) {
      error = err
    }

    // 5. post-execute 瀑布（改写文本）
    let text = error
      ? `错误: ${error instanceof Error ? error.message : String(error)}`
      : (opts.render?.(value) ?? JSON.stringify(value))
    text = this.bus.waterfall('tools/post-execute', text, inv) as string

    // 6. finalizeContent（内容级收尾，抛错 = isError）
    if (opts.finalizeContent && !error) {
      try {
        text = opts.finalizeContent(text)
      } catch (err) {
        error = err
        text = `错误: ${err instanceof Error ? err.message : String(err)}`
      }
    }

    const result: PipelineResult = { value: error ? null : value, text, isError: !!error }
    this.notify(inv, result)
    return result
  }

  private notify(inv: ToolInvocation, result: PipelineResult): void {
    this.bus.emit('tools/result', result, inv)
  }
}
