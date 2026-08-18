/** Orchestrator：子代理 Provider + 工作流 + 锁（第 50 课）。 */
import type { SubagentRegistry } from './types.ts'
import { WorkspaceLock } from './lock.ts'

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
        if (task.writePath && !this.lock.acquire(task.writePath)) {
          throw new Error(`路径被占用: ${task.writePath}`)
        }
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
