import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WorkspaceLock } from './lock.ts'
import { Orchestrator } from './orchestrator.ts'
import { SubagentRegistry, type SubagentProvider } from './types.ts'
import { WorkflowRunner, type WorkflowTask } from './workflow.ts'

// 本文件测多 Agent 编排：① 拓扑；② 并行；③ 锁；④ 编排器。

test('WorkflowRunner 按依赖顺序执行', async () => {
  const order: string[] = []
  const tasks: WorkflowTask[] = [
    { id: 'plan', run: async () => { order.push('plan') } },
    { id: 'code', deps: ['plan'], run: async () => { order.push('code') } },
    { id: 'docs', deps: ['plan'], run: async () => { order.push('docs') } },
    { id: 'test', deps: ['code'], run: async () => { order.push('test') } },
  ]
  await new WorkflowRunner().run(tasks)
  assert.ok(order.indexOf('plan') < order.indexOf('code'))
  assert.ok(order.indexOf('plan') < order.indexOf('docs'))
  assert.ok(order.indexOf('code') < order.indexOf('test'))
})

test('互不依赖的任务并行执行', async () => {
  let active = 0
  let maxActive = 0
  const tasks: WorkflowTask[] = [
    { id: 'a', run: async () => { active += 1; maxActive = Math.max(maxActive, active); await new Promise((r) => setTimeout(r, 10)); active -= 1 } },
    { id: 'b', run: async () => { active += 1; maxActive = Math.max(maxActive, active); await new Promise((r) => setTimeout(r, 1)); active -= 1 } },
  ]
  await new WorkflowRunner().run(tasks)
  assert.equal(maxActive, 2)
})

test('WorkspaceLock 防并发写同一路径', () => {
  const lock = new WorkspaceLock()
  assert.equal(lock.acquire('src/a.ts'), true)
  assert.equal(lock.acquire('src/a.ts'), false)
  lock.release('src/a.ts')
  assert.equal(lock.acquire('src/a.ts'), true)
})

test('Orchestrator 用子代理执行计划并收集结果', async () => {
  const provider: SubagentProvider = {
    name: 'mock',
    spawn: (prompt) => ({ id: 's1', result: Promise.resolve(`结果(${prompt})`) }),
  }
  const registry = new SubagentRegistry()
  registry.register(provider)
  const orchestrator = new Orchestrator(registry)
  const results = await orchestrator.run([
    { id: 'a', prompt: 'A', provider: 'mock' },
    { id: 'b', prompt: 'B', provider: 'mock', deps: ['a'], writePath: 'out.txt' },
  ])
  assert.equal(results.get('a'), '结果(A)')
  assert.equal(results.get('b'), '结果(B)')
})
