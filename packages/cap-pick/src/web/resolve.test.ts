import { test } from 'vitest'
import assert from 'node:assert/strict'
import { resolvePickFromNode } from './resolve.ts'
import { formatPicks, parsePicks, chipLabel } from './types.ts'
import { pickKindIcon } from './chip.tsx'
import { LuListTodo, LuMessageSquare, LuPuzzle, LuTag } from 'react-icons/lu'

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
  assert.equal(text, '<pick kind="session" id="abc" route="/s/abc" label="聊天" />')
  assert.doesNotMatch(text, /class=|svg|html/i)
})

test('parsePicks recovers chips that markdown would strip', () => {
  const raw = '<pick kind="task" id="t1" action="open" route="/tasks" label="写需求" />\n看这个'
  const parsed = parsePicks(raw)
  assert.equal(parsed.refs.length, 1)
  assert.equal(parsed.refs[0]?.kind, 'task')
  assert.equal(parsed.refs[0]?.id, 't1')
  assert.equal(parsed.refs[0]?.action, 'open')
  assert.equal(parsed.refs[0]?.label, '写需求')
  assert.equal(parsed.rest, '看这个')
})

test('kind maps to distinct icons', () => {
  assert.equal(pickKindIcon('session'), LuMessageSquare)
  assert.equal(pickKindIcon('task'), LuListTodo)
  assert.equal(pickKindIcon('plugin'), LuPuzzle)
  assert.equal(pickKindIcon('unknown'), LuTag)
})
