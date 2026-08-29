import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context, Service } from 'cordis'
import type { CollectionSpec } from '@biu/type-file-system'
import * as tasks2 from './index.ts'

test('apply registers /tasks on database, not by importing file-system', async () => {
  const ctx = new Context()
  const registered: CollectionSpec[] = []
  class FakeDb extends Service {
    constructor(c: Context) {
      super(c, 'database')
    }
    register(spec: CollectionSpec) {
      registered.push(spec)
    }
  }
  class FakeTasks extends Service {
    constructor(c: Context) {
      super(c, 'tasks')
    }
    list() {
      return [
        { id: 'p', title: '父任务', status: 'todo' },
        {
          id: 't1',
          title: '写方案',
          status: 'todo',
          parentId: 'p',
          reports: [{ sessionId: 's1', turn: 1, usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, totalTokens: 15 } }],
        },
      ]
    }
    get(id: string) {
      if (id === 'p') return { id: 'p', title: '父任务', status: 'todo' }
      return id === 't1' ? { id: 't1', title: '写方案', status: 'todo', parentId: 'p' } : undefined
    }
    update(id: string, patch: Record<string, unknown>) {
      return { id, title: '写方案', status: patch.status ?? 'todo' }
    }
  }
  new FakeDb(ctx)
  new FakeTasks(ctx)
  await ctx.plugin(tasks2)
  assert.equal(registered[0]?.path, '/tasks')
  assert.equal(registered[0]?.view?.moduleId, 'tasks-2')
  assert.equal(registered[0]?.view?.route, '/tasks-2')
  assert.equal(registered[0]?.view?.title, 'Task')
  assert.equal(registered[0]?.view?.icon, 'clipboard-document-list')
  assert.deepEqual(registered[0]?.schema.columns, ['title', 'status', 'priority', 'difficulty', 'usage', 'creator', 'assignee', 'project', 'tags', 'dueAt'])
  assert.equal(registered[0]?.schema.fields.usage?.computed, true)
  const listed = await registered[0]!.list()
  const child = listed.find((row) => row.id === 't1')
  const parent = listed.find((row) => row.id === 'p')
  assert.equal(child?.parentChain, '父任务')
  assert.equal(child?.usage, 15)
  assert.equal(parent?.usage, 15)
  assert.equal((parent?.usageParts as { aggregate?: boolean } | undefined)?.aggregate, true)
  const written = await registered[0]!.write!('t1', { status: 'doing' })
  assert.equal(written.status, 'doing')
})
