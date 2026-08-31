import { test } from 'vitest'
import assert from 'node:assert/strict'
import { builtinAllViewId } from '../catalog-views.ts'
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
  const spec = viewsCollection(store, () => [{ path: '/tasks', id: 'tasks', kind: 'collection', label: 'Task', view: { moduleId: 'tasks', route: '/tasks', title: 'Task' } }])
  assert.equal(spec.path, '/views')
  assert.equal(spec.view?.title, '视图')
  const rows = await spec.list()
  const all = rows.find((row) => row.viewId === builtinAllViewId('/tasks'))
  const user = rows.find((row) => row.id === 'tasks::v1')
  assert.equal(all?.title, '全部Task')
  assert.equal(all?.tablePath, '/tasks')
  assert.equal(user?.title, '默认视图')
  assert.equal(user?.table, 'Task')
  assert.equal(user?.sortField, 'dueAt')
  assert.equal(user?.filters, '{"status":"doing"}')
  const written = await spec.update!(String(user?.id), { title: 'Doing' })
  assert.equal(written.title, 'Doing')
  assert.throws(() => spec.update!(String(all?.id), { title: '改掉' }), /read-only/)
})

test('every registered table gets a builtin all-view even before the client syncs', async () => {
  const store = new SavedViewsStore()
  const spec = viewsCollection(store, () => [
    { path: '/sessions', id: 'sessions', kind: 'collection', label: '会话', view: { title: '会话' } },
    { path: '/events', id: 'events', kind: 'collection', label: '事件', view: { title: '事件' } },
  ])
  const rows = await spec.list()
  assert.equal(rows.length, 2)
  assert.equal(rows.find((row) => row.tablePath === '/sessions')?.title, '全部会话')
  assert.equal(rows.find((row) => row.tablePath === '/events')?.title, '全部事件')
})
