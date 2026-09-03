import { test } from 'vitest'
import assert from 'node:assert/strict'
import { headingsFromHtml, headingsFromRoot } from './heading-outline.ts'

test('headingsFromHtml extracts h1/h2 and skips chrome titles', () => {
  const html = `
    <h1 class="fsdb-detail-title">Record title</h1>
    <div class="page-editor">
      <h1>Intro</h1>
      <p>body</p>
      <h2>Section</h2>
      <h2></h2>
      <h3>ignored</h3>
    </div>
  `
  assert.deepEqual(headingsFromHtml(html), [
    { id: 'heading-0', text: 'Intro', level: 1 },
    { id: 'heading-1', text: 'Section', level: 2 },
  ])
})

test('headingsFromRoot stamps data-heading-outline on live nodes', () => {
  const root = document.createElement('div')
  root.innerHTML = '<h1>A</h1><h2>B</h2>'
  const items = headingsFromRoot(root)
  assert.deepEqual(
    items.map((item) => [item.text, item.level]),
    [
      ['A', 1],
      ['B', 2],
    ],
  )
  assert.equal(root.querySelector('[data-heading-outline="heading-0"]')?.textContent, 'A')
  assert.equal(root.querySelector('[data-heading-outline="heading-1"]')?.textContent, 'B')
})
