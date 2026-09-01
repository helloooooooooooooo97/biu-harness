import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  builtinAllView,
  builtinAllViewId,
  builtinCatalogViewId,
  builtinCatalogViews,
  isBuiltinCatalogViewId,
  mergeCatalogViews,
  mergeTableViews,
  stubBuiltinAllView,
  stubBuiltinCatalogView,
  catalogRowOpenTarget,
  builtinTagViewId,
  isBuiltinTagViewId,
  stampRowOpenTarget,
} from './catalog-views.ts'

test('each registered table gets a builtin catalog view', () => {
  const tables = [
    { id: 'views', path: '/views', kind: 'collection' as const, label: '视图', view: { moduleId: 'views-db', route: '/db-views', title: '视图' } },
    { id: 'pages', path: '/pages', kind: 'collection' as const, label: '页面', view: { moduleId: 'page', route: '/pages', title: '页面' } },
    { id: 'tasks', path: '/tasks', kind: 'collection' as const, label: '任务', view: { moduleId: 'tasks', route: '/tasks', title: '任务' } },
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
  assert.equal(merged[0]?.id, builtinAllViewId('/views'))
  assert.equal(merged[0]?.name, '全部视图')
  assert.equal(merged.filter((view) => view.builtin).length, 4)
  assert.equal(merged.some((view) => view.id === 'user-1'), true)
  assert.equal(merged.filter((view) => view.id === builtinCatalogViewId('/pages')).length, 1)
})

test('stub builtin catalog view from route id', () => {
  const stub = stubBuiltinCatalogView('builtin:/drawings')
  assert.equal(stub?.builtin, true)
  assert.deepEqual(stub?.filters, { tablePath: '/drawings' })
  assert.equal(stubBuiltinCatalogView('user-1'), null)
  assert.equal(isBuiltinCatalogViewId('builtin-all:/sessions'), false)
  assert.equal(stubBuiltinCatalogView('builtin-all:/sessions'), null)
})

test('every registered table gets a read-only 全部xx view', () => {
  const sessions = { id: 'sessions', path: '/sessions', kind: 'collection' as const, label: '会话', view: { title: '会话' } }
  const all = builtinAllView(sessions)
  assert.equal(all.id, builtinAllViewId('/sessions'))
  assert.equal(all.name, '全部会话')
  assert.deepEqual(all.filters, {})
  assert.equal(all.builtin, true)
  const merged = mergeTableViews(sessions, [
    { id: builtinAllViewId('/sessions'), name: '假的', mode: 'table', sortField: 'id', sortDir: 'asc', filters: {}, columns: [] },
    { id: 'mine', name: '置顶', mode: 'table', sortField: 'id', sortDir: 'asc', filters: {}, columns: [] },
  ])
  assert.equal(merged[0]?.name, '全部会话')
  assert.equal(merged.filter((view) => view.id === builtinAllViewId('/sessions')).length, 1)
  assert.equal(merged.some((view) => view.id === 'mine'), true)
  assert.equal(stubBuiltinAllView('builtin-all:/pages')?.name, '全部pages')
})

test('catalog view rows open the source table view instead of a record pane', () => {
  assert.deepEqual(catalogRowOpenTarget({ tablePath: '/plugins', viewId: builtinAllViewId('/plugins') }), {
    collection: '/plugins',
    viewId: builtinAllViewId('/plugins'),
  })
  assert.equal(catalogRowOpenTarget({ tablePath: '', viewId: 'x' }), null)
  assert.equal(catalogRowOpenTarget({ tablePath: '/events' }), null)
})

test('tags collection uses the same view list as other tables', () => {
  assert.equal(isBuiltinTagViewId(builtinTagViewId('dp')), true)
  assert.equal(isBuiltinCatalogViewId(builtinTagViewId('dp')), false)
  const table = { path: '/supertags', label: '标签', view: { title: '标签' } }
  const merged = mergeTableViews(table, [{ id: 'mine', name: '置顶', mode: 'table', sortField: 'id', sortDir: 'asc', filters: {}, columns: [] }])
  assert.equal(merged[0]?.id, builtinAllViewId('/supertags'))
  assert.equal(merged[0]?.name, '全部标签')
  assert.equal(merged.some((view) => isBuiltinTagViewId(view.id)), false)
  assert.equal(merged.some((view) => view.id === 'mine'), true)
})

test('stamp rows open the source record, not a tag view', () => {
  assert.deepEqual(stampRowOpenTarget({ tablePath: '/pages', sourceId: 'home' }), {
    collection: '/pages',
    recordId: 'home',
  })
  assert.equal(stampRowOpenTarget({ tablePath: '', sourceId: 'home' }), null)
})
