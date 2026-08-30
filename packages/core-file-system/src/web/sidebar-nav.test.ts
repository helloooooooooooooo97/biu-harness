import { test } from 'vitest'
import assert from 'node:assert/strict'
import { parseAppPath } from '@biu/web-session-view'
import {
  applySidebarAction,
  assertSidebarInvariants,
  buildCrumbs,
  parseCenterPath,
  pathForCenter,
  pathForCrumbTarget,
  previewKey,
  starPreviewKey,
  toggleExpandedViewKey,
  type SidebarNavAction,
  type SidebarNavState,
} from './sidebar-nav.ts'

const plugins = [{ id: 'database', label: '数据', path: '/database' }]

const TABLES = ['/tasks', '/pages'] as const
const VIEWS: Record<(typeof TABLES)[number], string[]> = {
  '/tasks': ['1787983501816', 'board'],
  '/pages': ['default', 'list'],
}
const RECORDS: Record<(typeof TABLES)[number], string[]> = {
  '/tasks': ['task_mtdbgnqj_5022je', 'task_other'],
  '/pages': ['page-1', 'page-2'],
}

function seedState(): SidebarNavState {
  return {
    collection: '/tasks',
    viewId: '1787983501816',
    lastViewId: '1787983501816',
    viewsOpen: true,
    expandedViewKey: null,
    openTables: { '/tasks': true },
  }
}

function randomOf<T>(rand: () => number, items: readonly T[]) {
  return items[Math.floor(rand() * items.length)]!
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomAction(rand: () => number, state: SidebarNavState): SidebarNavAction {
  const table = randomOf(rand, TABLES)
  const viewId = randomOf(rand, VIEWS[table])
  const recordId = randomOf(rand, RECORDS[table])
  const kinds: SidebarNavAction['type'][] = [
    'toggle-preview',
    'toggle-sidebar',
    'toggle-table',
    'open-view',
    'open-record',
    'close-record',
    'open-table',
  ]
  const type = randomOf(rand, kinds)
  if (type === 'toggle-preview') {
    const key = rand() < 0.5 ? previewKey(table, viewId) : starPreviewKey(table, viewId)
    return { type, key }
  }
  if (type === 'toggle-sidebar') return { type }
  if (type === 'toggle-table') return { type, path: table }
  if (type === 'open-view') return { type, path: table, viewId }
  if (type === 'open-record') return { type, path: table, viewId, recordId }
  if (type === 'close-record') return { type }
  return { type: 'open-table', path: table, viewId }
}

test('toggleExpandedViewKey 点两次回到原状，不会卡在展开', () => {
  const key = previewKey('/tasks', 'board')
  assert.equal(toggleExpandedViewKey(null, key), key)
  assert.equal(toggleExpandedViewKey(key, key), null)
  assert.equal(toggleExpandedViewKey(key, previewKey('/pages', 'default')), previewKey('/pages', 'default'))
})

test('点记录只换记录路由，不带 view，也不收起预览', () => {
  const before: SidebarNavState = {
    ...seedState(),
    expandedViewKey: previewKey('/tasks', '1787983501816'),
  }
  const action: SidebarNavAction = {
    type: 'open-record',
    path: '/tasks',
    viewId: 'board',
    recordId: 'task_mtdbgnqj_5022je',
  }
  const after = applySidebarAction(before, action)
  assertSidebarInvariants(before, action, after)
  assert.equal(after.expandedViewKey, before.expandedViewKey)
  assert.equal(pathForCenter(after), '/database/tasks/record/task_mtdbgnqj_5022je')
  assert.equal(parseAppPath(pathForCenter(after), plugins).kind, 'record')
})

test('点展开箭头不改路由；点侧栏开关不改路由', () => {
  const before = seedState()
  const expand = applySidebarAction(before, { type: 'toggle-preview', key: previewKey('/tasks', 'board') })
  assertSidebarInvariants(before, { type: 'toggle-preview', key: previewKey('/tasks', 'board') }, expand)
  const fold = applySidebarAction(expand, { type: 'toggle-preview', key: previewKey('/tasks', 'board') })
  assert.equal(fold.expandedViewKey, null)
  const hidden = applySidebarAction(expand, { type: 'toggle-sidebar' })
  assertSidebarInvariants(expand, { type: 'toggle-sidebar' }, hidden)
  assert.equal(pathForCenter(hidden), pathForCenter(expand))
})

test('从记录返回回到上次视图，展开状态仍在', () => {
  let state = { ...seedState(), expandedViewKey: previewKey('/tasks', '1787983501816') }
  state = applySidebarAction(state, {
    type: 'open-record',
    path: '/tasks',
    viewId: 'board',
    recordId: 'task_mtdbgnqj_5022je',
  })
  const closed = applySidebarAction(state, { type: 'close-record' })
  assertSidebarInvariants(state, { type: 'close-record' }, closed)
  assert.equal(closed.recordId, undefined)
  assert.equal(closed.viewId, '1787983501816')
  assert.equal(closed.expandedViewKey, previewKey('/tasks', '1787983501816'))
  assert.equal(pathForCenter(closed), '/database/tasks/view/1787983501816')
})

test('面包屑点上级会清掉后面几级', () => {
  const crumbs = buildCrumbs({
    collection: '/tasks',
    collectionLabel: 'Task',
    tables: [
      { path: '/tasks', label: 'Task' },
      { path: '/pages', label: 'Page' },
    ],
    viewId: '1787983501816',
    viewName: '默认视图',
    views: [
      { id: '1787983501816', name: '默认视图' },
      { id: 'board', name: '看板' },
    ],
  })
  assert.deepEqual(
    crumbs.map((item) => item.kind),
    ['collection', 'view'],
  )
  assert.equal(crumbs[0]!.label, 'Task')
  assert.equal(pathForCrumbTarget(crumbs[0]!.target), '/database/tasks')
  assert.equal(pathForCrumbTarget(crumbs[1]!.target), '/database/tasks/view/1787983501816')
  const pages = crumbs[0]!.choices.find((item) => item.id === '/pages')
  assert.equal(pathForCrumbTarget(pages!.target), '/database/pages')
})

test('记录页面包屑是表 / 视图 / 记录，点表只回到表', () => {
  const crumbs = buildCrumbs({
    collection: '/tasks',
    collectionLabel: 'Task',
    tables: [{ path: '/tasks', label: 'Task' }],
    viewId: '1787983501816',
    viewName: '默认视图',
    views: [{ id: '1787983501816', name: '默认视图' }],
    recordId: 'task_mtdbgnqj_5022je',
    recordLabel: '写文档',
    records: [{ id: 'task_mtdbgnqj_5022je', label: '写文档' }],
  })
  assert.deepEqual(
    crumbs.map((item) => item.kind),
    ['collection', 'view', 'record'],
  )
  assert.equal(pathForCrumbTarget(crumbs[0]!.target), '/database/tasks')
  assert.equal(pathForCrumbTarget(crumbs[1]!.target), '/database/tasks/view/1787983501816')
  assert.ok(!pathForCrumbTarget(crumbs[0]!.target).includes('/record/'))
  assert.ok(!pathForCrumbTarget(crumbs[1]!.target).includes('/record/'))
})

test('压测：随机切换表/视图/记录/展开，路由与展开不串台', () => {
  const seeds = [1, 7, 42, 99, 20260830]
  const steps = 400
  for (const seed of seeds) {
    const rand = mulberry32(seed)
    let state = seedState()
    for (let i = 0; i < steps; i++) {
      const action = randomAction(rand, state)
      const next = applySidebarAction(state, action)
      try {
        assertSidebarInvariants(state, action, next)
      } catch (err) {
        throw new Error(`seed=${seed} step=${i} action=${JSON.stringify(action)}: ${String(err)}`)
      }
      const parsed = parseCenterPath(pathForCenter(next))
      assert.ok(parsed, `seed=${seed} 路径解析失败 ${pathForCenter(next)}`)
      state = next
    }
  }
})
