import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context, Service } from 'cordis'
import type { CollectionChrome, CollectionViewType, DatabaseUi } from '@biu/type-file-system/ui'
import * as editorUi from './index.ts'
import { PageEditor } from './page-editor.tsx'

class FakeDatabaseUi extends Service implements DatabaseUi {
  paths: string[] = []
  constructor(ctx: Context) {
    super(ctx, 'databaseUi')
  }
  decorate(path: string, chrome: CollectionChrome) {
    this.paths.push(path)
    assert.equal(chrome.Content, PageEditor)
    return { dispose() {} }
  }
  registerView(_path: string, _view: CollectionViewType) {
    return { dispose() {} }
  }
  chrome() {
    return {}
  }
  views() {
    return []
  }
  subscribe() {
    return () => undefined
  }
}

test('core-editor paints Content on pages, tasks and plugins, not sessions', async () => {
  const ctx = new Context()
  const ui = new FakeDatabaseUi(ctx)
  await ctx.plugin(editorUi)
  assert.deepEqual(ui.paths, ['/pages', '/tasks', '/plugins'])
  assert.ok(ctx.pageEditor)
})
