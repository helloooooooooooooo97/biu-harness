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
    const a = tasks.create({ title: '写需求' })
    assert.equal(a.status, 'todo')
    const b = tasks.update(a.id, { status: 'doing', priority: 'high' })
    assert.equal(b.status, 'doing')
    assert.equal(b.priority, 'high')
    const listed = tasks.list({ status: 'doing' })
    assert.equal(listed.length, 1)
    assert.equal(listed[0]?.id, a.id)
    assert.equal(tasks.delete(a.id), true)
    assert.equal(tasks.list().length, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
