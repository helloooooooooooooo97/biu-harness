import { test } from 'vitest'
import assert from 'node:assert/strict'
import { builtinAllView, builtinAllViewId, builtinCatalogViewId } from '../catalog-views.ts'
import { VIEWS_COLLECTION_PATH } from './database-path.ts'
import {
  defaultViewId,
  persistViewDisplay,
  savedViewFromRecord,
  viewDisplayKey,
  viewForPath,
  withViewDisplay,
} from './view-storage.ts'

test('views collection still resolves catalog stubs from the route', () => {
  assert.equal(viewForPath(VIEWS_COLLECTION_PATH, 'builtin:/events')?.filters.tablePath, '/events')
  assert.equal(viewForPath(VIEWS_COLLECTION_PATH, builtinCatalogViewId('/events'))?.id, builtinCatalogViewId('/events'))
})

test('tables default to the builtin 全部xx view', () => {
  assert.equal(defaultViewId('/sessions'), builtinAllViewId('/sessions'))
  assert.equal(defaultViewId(VIEWS_COLLECTION_PATH), builtinAllViewId(VIEWS_COLLECTION_PATH))
  assert.equal(viewForPath('/sessions')?.builtin, true)
  assert.deepEqual(viewForPath('/sessions')?.filters, {})
})

test('builtin view wrap is stored as display prefs and restored', () => {
  const mem: Record<string, string> = {}
  const storage = {
    getItem: (key: string) => mem[key] ?? null,
    setItem: (key: string, value: string) => {
      mem[key] = value
    },
    removeItem: (key: string) => {
      delete mem[key]
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  const path = '/sessions'
  const id = builtinAllViewId(path)
  persistViewDisplay(path, id, { wrap: true, truncate: false })
  assert.equal(mem[viewDisplayKey(path, id)]?.includes('"wrap":true'), true)
  const painted = withViewDisplay(path, builtinAllView({ path, label: '会话', view: { title: '会话' } }))
  assert.equal(painted.wrap, true)
  assert.equal(painted.truncate, false)
  assert.equal(painted.builtin, true)
  assert.equal(painted.name, '全部会话')
  assert.equal(viewForPath(path)?.wrap, true)
})

test('builtin view columns overlay survives withViewDisplay', () => {
  const mem: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => mem[key] ?? null,
      setItem: (key: string, value: string) => {
        mem[key] = value
      },
      removeItem: (key: string) => {
        delete mem[key]
      },
    },
  })
  const path = '/sessions'
  const id = builtinAllViewId(path)
  persistViewDisplay(path, id, { columns: ['title', 'project'] })
  assert.deepEqual(withViewDisplay(path, builtinAllView({ path, label: '会话', view: { title: '会话' } })).columns, [
    'title',
    'project',
  ])
})

test('savedViewFromRecord skips builtin rows and keeps filters', () => {
  assert.equal(savedViewFromRecord({ viewId: builtinAllViewId('/tasks'), title: '全部' }), null)
  const view = savedViewFromRecord({
    viewId: 'v1',
    title: '看板',
    mode: 'board',
    sortField: 'dueAt',
    filters: '{"status":"doing"}',
    columns: ['title'],
  })
  assert.equal(view?.id, 'v1')
  assert.equal(view?.mode, 'board')
  assert.equal(view?.filters.status, 'doing')
})
