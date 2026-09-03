import { test } from 'vitest'
import assert from 'node:assert/strict'
import { headingElById, headingsFromHtml, headingsFromRoot } from './heading-outline.ts'

test('headingsFromHtml extracts h1–h3 and skips chrome titles', () => {
  const html = `
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
  assert.deepEqual(headingsFromHtml(html), [
    { id: 'heading-0', text: 'Intro', level: 1 },
    { id: 'heading-1', text: 'Section', level: 2 },
    { id: 'heading-2', text: 'Detail', level: 3 },
  ])
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
  assert.equal(root.querySelector('[data-heading-outline]'), null)
  assert.equal(fires, 0)
  mo.disconnect()
  assert.equal(headingElById(root, 'heading-2')?.textContent, 'C')
})
