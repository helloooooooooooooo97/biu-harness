import { test } from 'vitest'
import assert from 'node:assert/strict'
import { resolvePickFromNode, resolvePicksInRect } from './resolve.ts'
import { formatPicks, parsePicks, splitPickStream, chipLabel, dedupePicks } from './types.ts'
import { pickKindIcon } from './chip.tsx'
import { CpuChipIcon, ClipboardDocumentCheckIcon, ChatBubbleLeftIcon, PuzzlePieceIcon, TagIcon, TableCellsIcon } from '@heroicons/react/16/solid'

test('splitPickStream keeps text and chips in order', () => {
  const parts = splitPickStream('看 <pick kind="task" id="t1" label="写需求" /> 和 <pick kind="plugin" id="p1" label="Hello" /> 吧')
  assert.equal(parts.length, 5)
  assert.equal(parts[0]?.type, 'text')
  assert.equal(parts[1]?.type, 'pick')
  assert.equal(parts[1]?.type === 'pick' ? parts[1].ref.id : '', 't1')
  assert.equal(parts[3]?.type, 'pick')
  assert.equal(parts[3]?.type === 'pick' ? parts[3].ref.id : '', 'p1')
})

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
  assert.equal(pickKindIcon('session'), CpuChipIcon)
  assert.equal(pickKindIcon('message'), ChatBubbleLeftIcon)
  assert.notEqual(pickKindIcon('session'), pickKindIcon('message'))
  assert.equal(pickKindIcon('task'), ClipboardDocumentCheckIcon)
  assert.equal(pickKindIcon('page'), TableCellsIcon)
  assert.notEqual(pickKindIcon('collection'), pickKindIcon('usage'))
  assert.equal(pickKindIcon('plugin'), PuzzlePieceIcon)
  assert.equal(pickKindIcon('unknown'), TagIcon)
})

function stubBox(el: HTMLElement, left: number, top: number, width: number, height: number) {
  el.getBoundingClientRect = () =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON() {
        return {}
      },
    }) as DOMRect
}

test('marquee selects every kind+id object inside the rect', () => {
  const a = document.createElement('div')
  a.setAttribute('data-biu-kind', 'task')
  a.setAttribute('data-biu-id', 't1')
  a.setAttribute('data-biu-label', '甲')
  const b = document.createElement('div')
  b.setAttribute('data-biu-kind', 'task')
  b.setAttribute('data-biu-id', 't2')
  b.setAttribute('data-biu-label', '乙')
  const outside = document.createElement('div')
  outside.setAttribute('data-biu-kind', 'task')
  outside.setAttribute('data-biu-id', 't3')
  document.body.append(a, b, outside)
  stubBox(a, 10, 10, 40, 20)
  stubBox(b, 60, 12, 40, 20)
  stubBox(outside, 200, 10, 40, 20)
  const hits = resolvePicksInRect({ left: 0, top: 0, width: 120, height: 40 }, '/tasks')
  assert.deepEqual(
    hits.map((item) => item.ref.id).sort(),
    ['t1', 't2'],
  )
  a.remove()
  b.remove()
  outside.remove()
})

test('marquee skips ignored subtrees and inner action buttons', () => {
  const card = document.createElement('div')
  card.setAttribute('data-biu-kind', 'task')
  card.setAttribute('data-biu-id', 't1')
  const btn = document.createElement('button')
  btn.setAttribute('data-biu-action', 'open')
  card.append(btn)
  const ignored = document.createElement('div')
  ignored.setAttribute('data-biu-ignore', '')
  const inner = document.createElement('div')
  inner.setAttribute('data-biu-kind', 'session')
  inner.setAttribute('data-biu-id', 's1')
  ignored.append(inner)
  document.body.append(card, ignored)
  stubBox(card, 0, 0, 80, 40)
  stubBox(btn, 4, 4, 20, 12)
  stubBox(inner, 10, 10, 20, 20)
  const hits = resolvePicksInRect({ left: 0, top: 0, width: 100, height: 50 }, '/')
  assert.equal(hits.length, 1)
  assert.equal(hits[0]?.ref.kind, 'task')
  assert.equal(hits[0]?.ref.action, undefined)
  card.remove()
  ignored.remove()
})

test('dedupePicks keeps one chip per kind+id', () => {
  const refs = dedupePicks([
    { kind: 'task', id: 't1', label: '甲', route: '/tasks' },
    { kind: 'task', id: 't1', label: '甲', action: 'open', route: '/tasks' },
    { kind: 'task', id: 't2', label: '乙', route: '/tasks' },
  ])
  assert.equal(refs.length, 2)
  assert.equal(refs[0]?.id, 't1')
  assert.equal(refs[0]?.action, 'open')
  assert.equal(refs[1]?.id, 't2')
})
