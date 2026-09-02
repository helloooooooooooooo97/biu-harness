import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Editor } from '@tiptap/core'
import { pageEditorExtensions } from './kit.ts'
import { filterSlashItems, SLASH_ITEMS } from './slash.ts'

test('slash filter matches chinese labels and aliases', () => {
  assert.ok(filterSlashItems('标题').some((item) => item.id === 'h1'))
  assert.ok(filterSlashItems('code').some((item) => item.id === 'code'))
  assert.equal(filterSlashItems('zzz').length, 0)
  assert.equal(filterSlashItems('').length, SLASH_ITEMS.length)
})

test('markdown roundtrips headings lists quote and code', () => {
  const src = `# 大标题

一段 **粗** 和 *斜*。

- 苹果
- 梨

1. 先
2. 后

> 引用

\`\`\`ts
const a = 1
\`\`\`
`
  const editor = new Editor({
    extensions: pageEditorExtensions(),
    content: src,
    contentType: 'markdown',
  })
  const html = editor.getHTML()
  const out = editor.getMarkdown()
  assert.match(html, /<h1>大标题<\/h1>/)
  assert.match(html, /<strong>粗<\/strong>/)
  assert.match(out, /^# 大标题/m)
  assert.match(out, /\*\*粗\*\*/)
  assert.match(out, /苹果/)
  assert.match(out, /先/)
  assert.match(out, /引用/)
  assert.match(out, /const a = 1/)
  editor.destroy()
})

test('heading stays a native h1 without node-view wrappers', () => {
  const editor = new Editor({
    extensions: pageEditorExtensions(),
    content: '# 标题\n\n正文',
    contentType: 'markdown',
  })
  const html = editor.getHTML()
  assert.match(html, /<h1>标题<\/h1>/)
  assert.doesNotMatch(html, /data-node-view/)
  editor.destroy()
})

test('slash suggestion uses a fixed high stacking context', async () => {
  const { readFile } = await import('node:fs/promises')
  const { resolve } = await import('node:path')
  const src = await readFile(resolve(import.meta.dirname, './slash.ts'), 'utf8')
  const css = await readFile(resolve(import.meta.dirname, './style.ts'), 'utf8')
  assert.match(src, /strategy: 'fixed'/)
  assert.match(src, /zIndex = '10000'/)
  assert.match(css, /\.page-slash\{[^}]*z-index:10000/)
  assert.match(css, /\.page-editor \.page-block\{[^}]*isolation:isolate/)
})

test('slash command turns the current block into a heading', () => {
  const editor = new Editor({
    extensions: pageEditorExtensions(),
    content: '/',
    contentType: 'markdown',
  })
  const from = editor.state.selection.from - 1
  const heading = SLASH_ITEMS.find((item) => item.id === 'h1')
  assert.ok(heading)
  heading!.command({ editor, range: { from: Math.max(1, from), to: editor.state.selection.from } })
  assert.equal(editor.isActive('heading', { level: 1 }), true)
  editor.destroy()
})
