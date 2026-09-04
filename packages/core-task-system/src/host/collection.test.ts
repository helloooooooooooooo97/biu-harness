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
          dependsOn: ['p'],
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
  const spec = tasksCollection(tasks, {
    report: async () => ({ ok: 'report' }),
    deliver: async () => ({ ok: 'deliver' }),
  })
  assert.equal(spec.path, '/tasks')
  assert.equal(spec.view?.moduleId, 'tasks')
  assert.equal(spec.view?.route, '/tasks')
  assert.equal(spec.view?.title, '任务')
  assert.equal(spec.view?.inspector, true)
  assert.equal(spec.view?.icon, 'check-circle')
  assert.deepEqual(spec.schema.columns, ['title', 'status', 'priority', 'difficulty', 'usage', 'creator', 'assignee', 'project', 'tags', 'dueAt'])
  assert.equal(spec.schema.fields.usage?.computed, true)
  assert.equal(spec.schema.fields.assignee?.writable, true)
  assert.equal(spec.schema.fields.assigneeSessionId?.writable, true)
  assert.equal(spec.schema.fields.creator?.writable, undefined)
  const listed = await spec.list()
  const child = listed.find((row) => row.id === 't1')
  const parent = listed.find((row) => row.id === 'p')
  assert.equal(child?.parentChain, '父任务')
  assert.deepEqual(child?.dependsOn, ['p'])
  assert.equal(child?.usage, 15)
  assert.equal(parent?.usage, 15)
  assert.equal((parent?.usageParts as { aggregate?: boolean } | undefined)?.aggregate, true)
  const written = await spec.update!('t1', { status: 'doing' })
  assert.equal(written.status, 'doing')
  assert.deepEqual(spec.records, { update: true, create: true, delete: true })
  assert.equal(spec.actions?.find((item) => item.id === 'report')?.for, 'agent')
  assert.equal(spec.actions?.find((item) => item.id === 'deliver')?.for, 'both')
  assert.deepEqual(spec.actions?.find((item) => item.id === 'deliver')?.placement, ['row', 'detail'])
})

test('tasksCollection lets agents write assignee and stamps the creating session', async () => {
  const created: Array<Record<string, unknown>> = []
  const updated: Array<Record<string, unknown>> = []
  const tasks: TasksLike = {
    list: () => [],
    get: () => undefined,
    update(_id, patch) {
      updated.push(patch)
      return { id: 't1', title: '写方案', ...patch }
    },
    create(input) {
      created.push(input)
      return { id: 'new', title: input.title, creator: input.creator, assignee: input.assignee ?? null }
    },
    delete: () => true,
  }
  const spec = tasksCollection(tasks, undefined, {
    resolveCreator: async () => ({ kind: 'agent', sessionId: 'boss', name: '指挥' }),
    resolveAssignee: async (input) => {
      const sid = String(input.assigneeSessionId ?? input.assignee ?? '').trim()
      if (!sid) return null
      return { kind: 'agent', sessionId: sid, name: sid }
    },
  })
  const [row] = await spec.create!([{ title: '派工', assigneeSessionId: 'worker-1' }])
  assert.deepEqual(created[0]?.creator, { kind: 'agent', sessionId: 'boss', name: '指挥' })
  assert.deepEqual(created[0]?.assignee, { kind: 'agent', sessionId: 'worker-1', name: 'worker-1' })
  assert.equal(row?.creatorSessionId, 'boss')
  const written = await spec.update!('t1', { assignee: 'worker-2' })
  assert.deepEqual(updated[0]?.assignee, { kind: 'agent', sessionId: 'worker-2', name: 'worker-2' })
  assert.equal('assigneeSessionId' in (updated[0] ?? {}), false)
  assert.equal(written.assigneeSessionId, 'worker-2')
})
