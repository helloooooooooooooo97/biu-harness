import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WorkspaceLock, WorkflowRunner, type WorkflowTask } from './index.ts'

// 本文件测工作流：拓扑顺序、并行、锁。

test('WorkflowRunner 按依赖顺序执行', async () => {
  const order: string[] = []
  const tasks: WorkflowTask[] = [
    { id: 'plan', run: async () => { order.push('plan') } },
    { id: 'code', deps: ['plan'], run: async () => { order.push('code') } },
    { id: 'docs', deps: ['plan'], run: async () => { order.push('docs') } },
  ]
  await new WorkflowRunner().run(tasks)
  assert.ok(order.indexOf('plan') < order.indexOf('code'))
  assert.ok(order.indexOf('plan') < order.indexOf('docs'))
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
  assert.equal(lock.acquire('a.ts'), true)
  assert.equal(lock.acquire('a.ts'), false)
  lock.release('a.ts')
  assert.equal(lock.acquire('a.ts'), true)
})
