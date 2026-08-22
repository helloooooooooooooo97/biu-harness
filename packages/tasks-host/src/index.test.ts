import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from 'cordis'
import { coerceAssigneeArg, TasksService } from './index.ts'

test('tasks sqlite crud and status move', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tasks-'))
  const path = join(dir, 'tasks.sqlite')
  try {
    const ctx = new Context()
    const tasks = new TasksService(ctx, path).open()
    const a = tasks.create({
      title: '写需求',
      creator: { kind: 'user', name: '用户' },
    })
    assert.equal(a.status, 'todo')
    assert.equal(a.creator.name, '用户')
    assert.equal(a.assignee, null)
    assert.equal(a.assignedAt, null)
    assert.equal(a.description, '')

    const b = tasks.update(a.id, {
      status: 'doing',
      priority: 'high',
      description: '把需求写清楚',
      notes: '明天跟进',
      assignee: { kind: 'agent', sessionId: 'sess-1', name: 'Worker-A', mascot: { shape: 'blob', color: 'cyan' } },
    })
    assert.equal(b.status, 'doing')
    assert.equal(b.priority, 'high')
    assert.equal(b.description, '把需求写清楚')
    assert.equal(b.notes, '明天跟进')
    assert.equal(b.assignee?.sessionId, 'sess-1')
    assert.ok(b.assignedAt && b.assignedAt > 0)

    const listed = tasks.list({ status: 'doing' })
    assert.equal(listed.length, 1)
    assert.equal(listed[0]?.id, a.id)
    assert.equal(listed[0]?.creator.name, '用户')
    assert.equal(tasks.delete(a.id), true)
    assert.equal(tasks.list().length, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('coerceAssigneeArg accepts actor object, sessionId string, and person name', async () => {
  const host = { sessions: undefined } as never
  const actor = await coerceAssigneeArg(host, {
    kind: 'agent',
    sessionId: '856ffdc2-d00f-42e9-b084-d3d67a9c3e07',
    name: 'Cordis·后端开发',
    mascot: { shape: 'pebble', color: 'magenta', eye: 11 },
  })
  assert.equal(actor?.kind, 'agent')
  assert.equal(actor?.sessionId, '856ffdc2-d00f-42e9-b084-d3d67a9c3e07')
  assert.equal(actor?.name, 'Cordis·后端开发')
  assert.equal(actor?.mascot?.color, 'magenta')
  assert.notEqual(actor?.name, '[object Object]')

  const asJson = await coerceAssigneeArg(
    host,
    JSON.stringify({
      kind: 'agent',
      sessionId: '856ffdc2-d00f-42e9-b084-d3d67a9c3e07',
      name: 'Cordis·后端开发',
    }),
  )
  assert.equal(asJson?.sessionId, '856ffdc2-d00f-42e9-b084-d3d67a9c3e07')
  assert.equal(asJson?.name, 'Cordis·后端开发')

  const byId = await coerceAssigneeArg(host, '856ffdc2-d00f-42e9-b084-d3d67a9c3e07')
  assert.equal(byId?.kind, 'agent')
  assert.equal(byId?.sessionId, '856ffdc2-d00f-42e9-b084-d3d67a9c3e07')

  const person = await coerceAssigneeArg(host, 'Alice')
  assert.deepEqual(person, { kind: 'user', name: 'Alice' })

  assert.equal(await coerceAssigneeArg(host, null), null)
})
