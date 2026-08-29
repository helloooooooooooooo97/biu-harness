import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context, Service } from 'cordis'
import type { CollectionChrome, DatabaseUi } from '@biu/type-file-system/ui'
import * as tasks2Ui from './index.tsx'

class FakeDatabaseUi extends Service implements DatabaseUi {
  last: { path: string; chrome: CollectionChrome } | null = null
  constructor(ctx: Context) {
    super(ctx, 'databaseUi')
  }
  decorate(path: string, chrome: CollectionChrome) {
    this.last = { path, chrome }
    return { dispose() {} }
  }
  chrome() {
    return this.last?.chrome ?? {}
  }
  subscribe() {
    return () => undefined
  }
}

test('tasks-2 web paints /tasks chrome without importing file-system', async () => {
  const ctx = new Context()
  const ui = new FakeDatabaseUi(ctx)
  await ctx.plugin(tasks2Ui)
  assert.equal(ui.last?.path, '/tasks')
  assert.equal(typeof ui.last?.chrome.Title, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.status, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.priority, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.difficulty, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.usage, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.creator, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.assignee, 'function')
})
