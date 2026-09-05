import { test } from 'vitest'
import assert from 'node:assert/strict'
import { pickSurfaceAtPoint, resolvePickFromNode, resolvePickAtPoint, resolvePicksInRect, visiblePickBox } from './resolve.ts'
import { formatPicks, parsePicks, splitPickStream, chipLabel, dedupePicks, textPickFromSelection } from './types.ts'

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

test('picking does not look through the chat overlay', () => {
  const behind = document.createElement('div')
  behind.setAttribute('data-biu-kind', 'page')
  behind.setAttribute('data-biu-id', 'p1')
  const panel = document.createElement('div')
  panel.setAttribute('data-testid', 'chat-overlay-panel')
  document.body.append(behind, panel)
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: () => [panel, behind],
  })
  assert.equal(resolvePickAtPoint(0, 0, '/pages'), null)
  behind.remove()
  panel.remove()
})

test('formatPicks emits data handles only', () => {
  const text = formatPicks([
    { kind: 'session', id: 'abc', label: '聊天', route: '/s/abc' },
  ])
  assert.equal(text, '<pick kind="session" id="abc" route="/s/abc" label="聊天" />')
  assert.doesNotMatch(text, /class=|svg|html/i)
})

test('selected body text becomes a text pick', () => {
  const fake = {
    isCollapsed: false,
    rangeCount: 1,
    toString: () => '  这段正文  ',
  }
  const ref = textPickFromSelection('/s/abc', fake)
  assert.ok(ref)
  assert.equal(ref.kind, 'text')
  assert.equal(ref.label, '这段正文')
  assert.equal(ref.route, '/s/abc')
  assert.equal(textPickFromSelection('/', { isCollapsed: true, rangeCount: 1, toString: () => 'x' }), null)
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

test('marquee in the inspector does not take center-pane rows at the same height', () => {
  const center = document.createElement('div')
  center.style.overflow = 'hidden'
  const row = document.createElement('div')
  row.setAttribute('data-biu-kind', 'task')
  row.setAttribute('data-biu-id', 'center-row')
  center.append(row)
  const inspector = document.createElement('div')
  inspector.setAttribute('data-biu-kind', 'task')
  inspector.setAttribute('data-biu-id', 'inspector-row')
  document.body.append(center, inspector)
  stubBox(center, 80, 0, 120, 80)
  stubBox(row, 80, 10, 400, 20)
  stubBox(inspector, 220, 10, 80, 20)
  const hits = resolvePicksInRect({ left: 220, top: 8, width: 60, height: 24 }, '/tasks')
  assert.deepEqual(
    hits.map((item) => item.ref.id),
    ['inspector-row'],
  )
  const vis = visiblePickBox(row)
  assert.ok(vis)
  assert.equal(vis.left, 80)
  assert.equal(vis.width, 120)
  center.remove()
  inspector.remove()
})

test('clicking over the inspector does not pick overflowing center chat', () => {
  const inspector = document.createElement('aside')
  inspector.setAttribute('data-testid', 'session-inspector')
  const chrome = document.createElement('div')
  inspector.append(chrome)
  const chat = document.createElement('div')
  chat.setAttribute('data-biu-kind', 'message')
  chat.setAttribute('data-biu-id', 'm1')
  document.body.append(inspector, chat)
  stubBox(inspector, 220, 0, 200, 400)
  stubBox(chrome, 220, 0, 200, 400)
  stubBox(chat, 0, 10, 480, 40)
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: () => [chat],
  })
  assert.equal(pickSurfaceAtPoint(240, 20), inspector)
  assert.equal(resolvePickAtPoint(240, 20, '/s/abc'), null)
  inspector.remove()
  chat.remove()
})

test('clicking the inspector table does not pick chat stacked underneath', () => {
  const inspector = document.createElement('aside')
  inspector.setAttribute('data-testid', 'session-inspector')
  const pane = document.createElement('div')
  pane.className = 'inspector-stage-pane is-active'
  const row = document.createElement('tr')
  row.setAttribute('data-biu-kind', 'task')
  row.setAttribute('data-biu-id', 't-row')
  pane.append(row)
  inspector.append(pane)
  const chat = document.createElement('div')
  chat.setAttribute('data-biu-kind', 'message')
  chat.setAttribute('data-biu-id', 'm1')
  document.body.append(inspector, chat)
  stubBox(row, 220, 10, 80, 20)
  stubBox(chat, 0, 10, 400, 20)
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: () => [chat, row],
  })
  const hit = resolvePickAtPoint(240, 16, '/tasks')
  assert.equal(hit?.ref.kind, 'task')
  assert.equal(hit?.ref.id, 't-row')
  inspector.remove()
  chat.remove()
})

test('inactive inspector trajectory pane is not pickable', () => {
  const inspector = document.createElement('aside')
  inspector.setAttribute('data-testid', 'session-inspector')
  const hidden = document.createElement('div')
  hidden.className = 'inspector-stage-pane'
  const msg = document.createElement('div')
  msg.setAttribute('data-biu-kind', 'message')
  msg.setAttribute('data-biu-id', 'ghost')
  hidden.append(msg)
  inspector.append(hidden)
  document.body.append(inspector)
  stubBox(msg, 220, 10, 80, 40)
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: () => [msg],
  })
  assert.equal(resolvePickAtPoint(240, 20, '/s/abc'), null)
  inspector.remove()
})

test('marquee scoped to inspector skips center chat', () => {
  const inspector = document.createElement('aside')
  inspector.setAttribute('data-testid', 'session-inspector')
  const row = document.createElement('div')
  row.setAttribute('data-biu-kind', 'task')
  row.setAttribute('data-biu-id', 't-row')
  inspector.append(row)
  const chat = document.createElement('div')
  chat.setAttribute('data-biu-kind', 'message')
  chat.setAttribute('data-biu-id', 'm1')
  document.body.append(inspector, chat)
  stubBox(row, 220, 10, 80, 20)
  stubBox(chat, 220, 10, 80, 20)
  const hits = resolvePicksInRect({ left: 220, top: 8, width: 60, height: 24 }, '/tasks', inspector)
  assert.deepEqual(
    hits.map((item) => item.ref.id),
    ['t-row'],
  )
  inspector.remove()
  chat.remove()
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
