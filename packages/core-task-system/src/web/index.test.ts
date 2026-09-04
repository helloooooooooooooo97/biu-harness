import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context, Service } from 'cordis'
import type { CollectionChrome, CollectionViewType, DatabaseUi } from '@biu/type-file-system/ui'
import * as taskSystemUi from './index.tsx'

class FakeDatabaseUi extends Service implements DatabaseUi {
  last: { path: string; chrome: CollectionChrome } | null = null
  registered: Array<{ path: string; view: CollectionViewType }> = []
  constructor(ctx: Context) {
    super(ctx, 'databaseUi')
  }
  decorate(path: string, chrome: CollectionChrome) {
    this.last = { path, chrome }
    return { dispose() {} }
  }
  registerView(path: string, view: CollectionViewType) {
    this.registered.push({ path, view })
    return { dispose() {} }
  }
  chrome() {
    return this.last?.chrome ?? {}
  }
  views(path: string) {
    return this.registered.filter((item) => item.path === path).map((item) => item.view)
  }
  subscribe() {
    return () => undefined
  }
}

test('task-system web paints /tasks chrome without importing file-system', async () => {
  const ctx = new Context()
  const ui = new FakeDatabaseUi(ctx)
  await ctx.plugin(taskSystemUi)
  assert.equal(ui.last?.path, '/tasks')
  assert.equal(typeof ui.last?.chrome.Title, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.status, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.priority, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.difficulty, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.usage, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.creator, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.assignee, 'function')
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const chrome = readFileSync(resolve(import.meta.dirname, './chrome.tsx'), 'utf8')
  assert.match(chrome, /which="creator"/)
  assert.match(chrome, /which="assignee"/)
  assert.match(chrome, /选择执行人/)
  assert.match(chrome, /\/api\/db\/update/)
  assert.doesNotMatch(chrome, /\/api\/tasks/)
  assert.doesNotMatch(chrome, /选择承担者/)
  assert.equal(ui.last?.chrome.panes?.map((pane) => pane.id).join(','), 'script,reports')
  assert.equal(ui.registered[0]?.path, '/tasks')
  assert.equal(ui.registered[0]?.view.id, 'graph')
  assert.equal(ui.registered[0]?.view.label, '依赖图')
})

test('task tags use public-ui TagChip', async () => {
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const chrome = readFileSync(resolve(import.meta.dirname, './chrome.tsx'), 'utf8')
  const css = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.match(chrome, /TagChip/)
  assert.doesNotMatch(chrome, /className="tasks-tag"/)
  assert.doesNotMatch(chrome, /placeholder=\{tags\.length \? '\+' : '添加标签'\}/)
  assert.doesNotMatch(chrome, /placeholder="项目"/)
  assert.doesNotMatch(css, /\.tasks-tag\{/)
})
