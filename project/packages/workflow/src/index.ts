/** 多 Agent 编排：DAG + 锁 + Orchestrator（第 50 课）。 */
import type { SubagentRegistry } from '@mini-dsh/subagent'

export interface WorkflowTask {
  id: string
  deps?: string[]
  run(ctx: { resultOf(id: string): unknown }): Promise<unknown>
}

export class WorkflowRunner {
  async run(tasks: WorkflowTask[]): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>()
    const done = new Set<string>()
    const ctx = { resultOf: (id: string) => results.get(id) }

    while (done.size < tasks.length) {
      const ready = tasks.filter((t) => !done.has(t.id) && (t.deps ?? []).every((d) => done.has(d)))
      if (ready.length === 0) throw new Error('存在循环依赖')
      await Promise.all(ready.map(async (t) => {
        results.set(t.id, await t.run(ctx))
        done.add(t.id)
      }))
    }
    return results
  }
}

export class WorkspaceLock {
  private readonly held = new Set<string>()

  acquire(path: string): boolean {
    if (this.held.has(path)) return false
    this.held.add(path)
    return true
  }

  release(path: string): void {
    this.held.delete(path)
  }
}

export interface AgentPlanTask {
  id: string
  prompt: string
  provider: string
  deps?: string[]
  writePath?: string
}

export class Orchestrator {
  constructor(
    private readonly subagents: SubagentRegistry,
    private readonly lock = new WorkspaceLock(),
  ) {}

  async run(plan: AgentPlanTask[]): Promise<Map<string, string>> {
    const results = new Map<string, string>()
    const done = new Set<string>()

    while (done.size < plan.length) {
      const ready = plan.filter((t) => !done.has(t.id) && (t.deps ?? []).every((d) => done.has(d)))
      if (ready.length === 0) throw new Error('存在循环依赖')
      await Promise.all(ready.map(async (task) => {
        if (task.writePath && !this.lock.acquire(task.writePath)) throw new Error(`路径被占用: ${task.writePath}`)
        try {
          const handle = this.subagents.get(task.provider).spawn(task.prompt)
          results.set(task.id, await handle.result)
          done.add(task.id)
        } finally {
          if (task.writePath) this.lock.release(task.writePath)
        }
      }))
    }
    return results
  }
}
