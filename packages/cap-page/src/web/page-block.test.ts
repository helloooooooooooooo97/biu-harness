import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Editor } from '@tiptap/core'
import { Context } from 'cordis'
import { pageEditorExtensions } from './kit.ts'
import { filterSlashItems } from './slash.ts'
import { PageEditorService } from './service.ts'

test('registerBlock adds a slash item and inserts pageBlock', async () => {
  const ctx = new Context()
  new PageEditorService(ctx)
  const fiber = ctx.plugin({
    name: 'algo',
    inject: ['pageEditor'],
    apply(inner) {
      inner.pageEditor.registerBlock({
        kind: 'algorithm',
        label: '算法题',
        aliases: ['leetcode'],
        defaults: { title: 'Two Sum' },
        View: () => null,
      })
    },
  })
  await fiber
  const item = filterSlashItems('leetcode').find((entry) => entry.id === 'algorithm')
  assert.equal(item?.label, '算法题')
  const editor = new Editor({
    extensions: pageEditorExtensions(),
    content: '/',
    contentType: 'markdown',
  })
  const from = editor.state.selection.from - 1
  item!.command({ editor, range: { from: Math.max(1, from), to: editor.state.selection.from } })
  const json = editor.getJSON()
  const block = json.content?.find((node) => node.type === 'pageBlock')
  assert.equal(block?.attrs?.kind, 'algorithm')
  assert.equal((block?.attrs?.data as { title?: string })?.title, 'Two Sum')
  const md = editor.getMarkdown()
  assert.match(md, /:::pageBlock \{kind=algorithm\}/)
  assert.match(md, /Two Sum/)
  editor.destroy()
  await fiber.dispose()
  assert.equal(filterSlashItems('leetcode').some((entry) => entry.id === 'algorithm'), false)
})

test('pageBlock markdown roundtrips kind and data', () => {
  const src = `:::pageBlock {kind=algorithm}
{"title":"Two Sum","lang":"python"}
:::
`
  const editor = new Editor({
    extensions: pageEditorExtensions(),
    content: src,
    contentType: 'markdown',
  })
  const json = editor.getJSON()
  const block = json.content?.find((node) => node.type === 'pageBlock')
  assert.equal(block?.attrs?.kind, 'algorithm')
  assert.equal((block?.attrs?.data as { title?: string })?.title, 'Two Sum')
  const out = editor.getMarkdown()
  assert.match(out, /:::pageBlock \{kind=algorithm\}/)
  assert.match(out, /Two Sum/)
  editor.destroy()
})

test('pageBlock markdown roundtrips excalidraw scene', () => {
  const src = `:::pageBlock {kind=excalidraw}
{"height":420,"zoom":1.25}
:::
`
  const editor = new Editor({
    extensions: pageEditorExtensions(),
    content: src,
    contentType: 'markdown',
  })
  const json = editor.getJSON()
  const block = json.content?.find((node) => node.type === 'pageBlock')
  assert.equal(block?.attrs?.kind, 'excalidraw')
  assert.equal((block?.attrs?.data as { zoom?: number })?.zoom, 1.25)
  editor.destroy()
})

test('pageBlock capture includes drawing surfaces', async () => {
  const { readFile } = await import('node:fs/promises')
  const { resolve } = await import('node:path')
  const src = await readFile(resolve(import.meta.dirname, './page-block.ts'), 'utf8')
  assert.match(src, /data-page-block-capture/)
  assert.match(src, /\.excalidraw/)
  assert.match(src, /canvas/)
})
