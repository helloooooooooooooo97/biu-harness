import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from 'cordis'
import { TasksService } from './index.ts'

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
