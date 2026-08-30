import { test } from 'vitest'
import assert from 'node:assert/strict'
import { SavedViewsStore, viewsCollection } from './saved-views.ts'

test('viewsCollection lists saved views with source table', async () => {
  const store = new SavedViewsStore()
  store.replace('/tasks', [
    {
      id: 'v1',
      name: '默认视图',
      mode: 'table',
      sortField: 'dueAt',
      sortDir: 'asc',
      filters: { status: 'doing' },
      columns: ['title', 'status'],
      query: 'foo',
    },
  ])
  const spec = viewsCollection(store, () => [{ path: '/tasks', id: 'tasks', kind: 'collection', label: 'Task', view: { moduleId: 'tasks-2', route: '/tasks-2', title: 'Task' } }])
  assert.equal(spec.path, '/views')
  assert.equal(spec.view?.title, '视图')
  const rows = await spec.list()
  assert.equal(rows[0]?.title, '默认视图')
  assert.equal(rows[0]?.table, 'Task')
  assert.equal(rows[0]?.tablePath, '/tasks')
  assert.equal(rows[0]?.sortField, 'dueAt')
  assert.equal(rows[0]?.filters, '{"status":"doing"}')
  const written = await spec.update!(String(rows[0]?.id), { title: 'Doing' })
  assert.equal(written.title, 'Doing')
})
