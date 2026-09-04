import { test } from 'vitest'
import assert from 'node:assert/strict'
import { headingsFromRoot } from './heading-outline.ts'

test('headingsFromRoot extracts h1–h3 and skips chrome titles', () => {
  const root = document.createElement('div')
  root.innerHTML = `
    <h1 class="fsdb-detail-title">Record title</h1>
    <div class="page-editor">
      <h1>Intro</h1>
      <p>body</p>
      <h2>Section</h2>
      <h3>Detail</h3>
      <h2></h2>
      <h4>ignored</h4>
    </div>
    <h3 class="fsdb-detail-extra-title">Related</h3>
  `
  assert.deepEqual(
    headingsFromRoot(root).map((item) => [item.id, item.text, item.level]),
    [
      ['heading-0', 'Intro', 1],
      ['heading-1', 'Section', 2],
      ['heading-2', 'Detail', 3],
    ],
  )
})

test('headingsFromRoot is read-only so TipTap headings do not trip MutationObserver', () => {
  const root = document.createElement('div')
  root.innerHTML = '<div class="tiptap"><h1>A</h1><h2>B</h2><h3>C</h3></div>'
  let fires = 0
  const mo = new MutationObserver(() => {
    fires += 1
    headingsFromRoot(root)
  })
  mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true })
  const items = headingsFromRoot(root)
  assert.deepEqual(
    items.map((item) => [item.id, item.text, item.level]),
    [
      ['heading-0', 'A', 1],
      ['heading-1', 'B', 2],
      ['heading-2', 'C', 3],
    ],
  )
  assert.equal(fires, 0)
  mo.disconnect()
})

test('session outline is one tick per user bubble, never reply headings', () => {
  const root = document.createElement('div')
  root.innerHTML = `
    <h1 class="fsdb-detail-title">Session title</h1>
    <div data-chat-kind="user" data-node-id="u-1">
      <div data-testid="user-bubble">hello from me</div>
      <div>回复栏</div>
    </div>
    <div data-chat-kind="reply"><h2>Section in reply</h2></div>
    <div data-chat-kind="user" data-node-id="u-2">
      <div data-testid="user-bubble">second question</div>
    </div>
  `
  assert.deepEqual(
    headingsFromRoot(root).map((item) => [item.id, item.text, item.level]),
    [
      ['u-1', 'hello from me', 1],
      ['u-2', 'second question', 1],
    ],
  )
})
