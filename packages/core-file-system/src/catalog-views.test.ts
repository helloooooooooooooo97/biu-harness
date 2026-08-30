import { test } from 'vitest'
import assert from 'node:assert/strict'
import { builtinCatalogViewId, builtinCatalogViews, mergeCatalogViews, stubBuiltinCatalogView } from './catalog-views.ts'

test('each registered table gets a builtin catalog view', () => {
  const tables = [
    { id: 'views', path: '/views', kind: 'collection' as const, label: '视图', view: { moduleId: 'views-db', route: '/db-views', title: '视图' } },
    { id: 'pages', path: '/pages', kind: 'collection' as const, label: '页面', view: { moduleId: 'page', route: '/pages', title: '页面' } },
    { id: 'tasks', path: '/tasks', kind: 'collection' as const, label: '任务', view: { moduleId: 'tasks-2', route: '/tasks-2', title: '任务' } },
  ]
  const listed = builtinCatalogViews(tables)
  assert.equal(listed.length, 3)
  assert.equal(listed[1]?.id, builtinCatalogViewId('/pages'))
  assert.equal(listed[1]?.name, '页面')
  assert.deepEqual(listed[1]?.filters, { tablePath: '/pages' })
  assert.equal(listed[1]?.builtin, true)
  const merged = mergeCatalogViews(tables, [
    { id: builtinCatalogViewId('/pages'), name: '旧的', mode: 'table', sortField: 'id', sortDir: 'asc', filters: {}, columns: [] },
    { id: 'user-1', name: '周报', mode: 'table', sortField: 'id', sortDir: 'asc', filters: {}, columns: [] },
  ])
  assert.equal(merged.filter((view) => view.builtin).length, 3)
  assert.equal(merged.some((view) => view.id === 'user-1'), true)
  assert.equal(merged.filter((view) => view.id === builtinCatalogViewId('/pages')).length, 1)
})

test('stub builtin catalog view from route id', () => {
  const stub = stubBuiltinCatalogView('builtin:/drawings')
  assert.equal(stub?.builtin, true)
  assert.deepEqual(stub?.filters, { tablePath: '/drawings' })
  assert.equal(stubBuiltinCatalogView('user-1'), null)
})
