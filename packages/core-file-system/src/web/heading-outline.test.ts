import { test } from 'vitest'
import assert from 'node:assert/strict'
import { headingsFromHtml, headingsFromRoot } from './heading-outline.ts'

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

test('headingsFromRoot stamps data-heading-outline on live nodes', () => {
  const root = document.createElement('div')
  root.innerHTML = '<h1>A</h1><h2>B</h2><h3>C</h3>'
  const items = headingsFromRoot(root)
  assert.deepEqual(
    items.map((item) => [item.text, item.level]),
    [
      ['A', 1],
      ['B', 2],
      ['C', 3],
    ],
  )
  assert.equal(root.querySelector('[data-heading-outline="heading-2"]')?.textContent, 'C')
})
