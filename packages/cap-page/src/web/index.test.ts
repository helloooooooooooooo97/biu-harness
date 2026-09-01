import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context, Service } from 'cordis'
import type { CollectionChrome, CollectionViewType, DatabaseUi } from '@biu/type-file-system/ui'
import * as pageUi from './index.ts'
import { pagesChrome } from './chrome.tsx'

class FakeDatabaseUi extends Service implements DatabaseUi {
  last: { path: string; chrome: CollectionChrome } | null = null
  constructor(ctx: Context) {
    super(ctx, 'databaseUi')
  }
  decorate(path: string, chrome: CollectionChrome) {
    this.last = { path, chrome }
    return { dispose() {} }
  }
  registerView(_path: string, _view: CollectionViewType) {
    return { dispose() {} }
  }
  chrome() {
    return this.last?.chrome ?? {}
  }
  views() {
    return []
  }
  subscribe() {
    return () => undefined
  }
}

test('page web paints /pages content chrome', async () => {
  const ctx = new Context()
  const ui = new FakeDatabaseUi(ctx)
  await ctx.plugin(pageUi)
  assert.equal(ui.last?.path, '/pages')
  assert.equal(ui.last?.chrome.Content, pagesChrome.Content)
  assert.ok(ctx.pageEditor)
})
