import { test } from 'vitest'
import assert from 'node:assert/strict'
import { tasksCollection, type TasksLike } from './collection.ts'

test('tasksCollection maps /tasks rows with rolled-up usage', async () => {
  const tasks: TasksLike = {
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
    },
    get(id) {
      if (id === 'p') return { id: 'p', title: '父任务', status: 'todo' }
      return id === 't1' ? { id: 't1', title: '写方案', status: 'todo', parentId: 'p' } : undefined
    },
    update(id, patch) {
      return { id, title: '写方案', status: patch.status ?? 'todo' }
    },
    create(input) {
      return { id: 'new', title: input.title, status: 'todo' }
    },
    delete() {
      return true
    },
  }
  const spec = tasksCollection(tasks)
  assert.equal(spec.path, '/tasks')
  assert.equal(spec.view?.moduleId, 'tasks')
  assert.equal(spec.view?.route, '/tasks')
  assert.equal(spec.view?.title, '任务')
  assert.equal(spec.view?.inspector, true)
  assert.equal(spec.view?.icon, 'clipboard-document-list')
  assert.deepEqual(spec.schema.columns, ['title', 'status', 'priority', 'difficulty', 'usage', 'creator', 'assignee', 'project', 'tags', 'dueAt'])
  assert.equal(spec.schema.fields.usage?.computed, true)
  const listed = await spec.list()
  const child = listed.find((row) => row.id === 't1')
  const parent = listed.find((row) => row.id === 'p')
  assert.equal(child?.parentChain, '父任务')
  assert.equal(child?.usage, 15)
  assert.equal(parent?.usage, 15)
  assert.equal((parent?.usageParts as { aggregate?: boolean } | undefined)?.aggregate, true)
  const written = await spec.update!('t1', { status: 'doing' })
  assert.equal(written.status, 'doing')
  assert.deepEqual(spec.records, { update: true, create: true, delete: true })
  const created = await spec.create!({ title: '新任务' })
  assert.equal(created.title, '新任务')
})
