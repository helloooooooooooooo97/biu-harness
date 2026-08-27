import { test } from 'vitest'
import assert from 'node:assert/strict'
import { resolvePickFromNode } from './resolve.ts'
import { formatPicks, chipLabel } from './types.ts'

test('merges child action onto parent kind/id', () => {
  const card = document.createElement('div')
  card.setAttribute('data-biu-kind', 'task')
  card.setAttribute('data-biu-id', 't1')
  card.setAttribute('data-biu-label', '写需求')
  const btn = document.createElement('button')
  btn.setAttribute('data-biu-action', 'open')
  card.append(btn)
  document.body.append(card)
  const hit = resolvePickFromNode(btn, '/tasks')
  assert.ok(hit)
  assert.equal(hit.ref.kind, 'task')
  assert.equal(hit.ref.id, 't1')
  assert.equal(hit.ref.action, 'open')
  assert.equal(hit.ref.label, '写需求')
  assert.equal(chipLabel(hit.ref), '写需求 · open')
  card.remove()
})

test('ignored subtrees are not pickable', () => {
  const wrap = document.createElement('div')
  wrap.setAttribute('data-biu-ignore', '')
  const inner = document.createElement('div')
  inner.setAttribute('data-biu-kind', 'session')
  inner.setAttribute('data-biu-id', 's1')
  wrap.append(inner)
  document.body.append(wrap)
  assert.equal(resolvePickFromNode(inner, '/'), null)
  wrap.remove()
})

test('formatPicks emits data handles only', () => {
  const text = formatPicks([
    { kind: 'session', id: 'abc', label: '聊天', route: '/s/abc' },
  ])
  assert.equal(text, '<pick kind="session" id="abc" route="/s/abc" />')
  assert.doesNotMatch(text, /class=|svg|html/i)
})
