/** 多 Agent 工作流：DAG + 拓扑执行 + 并行分支（第 50 课）。 */

export interface WorkflowTask {
  id: string
  deps?: string[]
  run(ctx: { resultOf(id: string): unknown }): Promise<unknown>
}

export class WorkflowRunner {
  async run(tasks: WorkflowTask[]): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>()
    const byId = new Map(tasks.map((t) => [t.id, t]))
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
