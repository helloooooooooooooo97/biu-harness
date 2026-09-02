import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Editor } from '@tiptap/core'
import { Context } from 'cordis'
import { pageEditorExtensions } from './kit.ts'
import { filterSlashItems } from './slash.ts'
import { PageEditorService } from './service.ts'
import { duplicateAssetPath } from './page-block.ts'

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

test('pageBlock markdown roundtrips excalidraw as a file pointer only', () => {
  const src = `:::pageBlock {kind=excalidraw}
{"file":"assets/excalidraw-demo.json"}
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
  assert.deepEqual(block?.attrs?.data, { file: 'assets/excalidraw-demo.json' })
  const out = editor.getMarkdown()
  assert.match(out, /"file": "assets\/excalidraw-demo.json"/)
  assert.doesNotMatch(out, /"elements"/)
  assert.doesNotMatch(out, /"height"/)
  editor.destroy()
})

test('slash insert for excalidraw only puts a file pointer in the node', async () => {
  const ctx = new Context()
  new PageEditorService(ctx)
  const fiber = ctx.plugin({
    name: 'draw',
    inject: ['pageEditor'],
    apply(inner) {
      inner.pageEditor.registerBlock({
        kind: 'excalidraw',
        label: '画板',
        defaults: () => ({ file: 'assets/excalidraw-new.json' }),
        View: () => null,
      })
    },
  })
  await fiber
  const item = filterSlashItems('画板').find((entry) => entry.id === 'excalidraw')
  const editor = new Editor({
    extensions: pageEditorExtensions(),
    content: '/',
    contentType: 'markdown',
  })
  const from = editor.state.selection.from - 1
  item!.command({ editor, range: { from: Math.max(1, from), to: editor.state.selection.from } })
  const block = editor.getJSON().content?.find((node) => node.type === 'pageBlock')
  assert.deepEqual(block?.attrs?.data, { file: 'assets/excalidraw-new.json' })
  assert.doesNotMatch(editor.getMarkdown(), /elements/)
  editor.destroy()
  await fiber.dispose()
})

test('duplicate pageBlock file pointers get a cloneFrom copy', () => {
  assert.match(duplicateAssetPath('assets/画板.json'), /^assets\/画板-copy-[0-9a-f]{8}\.json$/)
  const editor = new Editor({
    extensions: pageEditorExtensions(),
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  })
  editor.commands.setContent({
    type: 'doc',
    content: [
      { type: 'pageBlock', attrs: { kind: 'excalidraw', data: { file: 'assets/board.json' } } },
      { type: 'pageBlock', attrs: { kind: 'excalidraw', data: { file: 'assets/board.json' } } },
    ],
  })
  const blocks = editor.getJSON().content?.filter((node) => node.type === 'pageBlock') ?? []
  assert.equal(blocks.length, 2)
  const first = blocks[0]?.attrs?.data as { file?: string; cloneFrom?: string }
  const second = blocks[1]?.attrs?.data as { file?: string; cloneFrom?: string }
  assert.equal(first.file, 'assets/board.json')
  assert.ok(second.file && second.file !== first.file)
  assert.equal(second.cloneFrom, 'assets/board.json')
  assert.doesNotMatch(editor.getMarkdown(), /cloneFrom/)
  editor.destroy()
})

test('pageBlock capture includes drawing surfaces', async () => {
  const { readFile } = await import('node:fs/promises')
  const { resolve } = await import('node:path')
  const src = await readFile(resolve(import.meta.dirname, './page-block.ts'), 'utf8')
  assert.match(src, /data-page-block-capture/)
  assert.match(src, /\.excalidraw/)
  assert.match(src, /canvas/)
  const view = await readFile(resolve(import.meta.dirname, './page-block-view.tsx'), 'utf8')
  assert.match(view, /draggable=\{kind !== 'excalidraw'\}/)
  assert.match(src, /dragstart/)
})
