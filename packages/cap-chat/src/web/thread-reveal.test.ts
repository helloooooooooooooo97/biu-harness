import { afterEach, describe, expect, it } from 'vitest'
import type { ChatNode } from '@biu/web-session-view'
import {
  bumpRevealStart,
  captureChatScroll,
  CHAT_FIRST_PAINT_TURNS,
  firstPaintStartIndex,
  groupNodesIntoTurns,
  recalledChatScroll,
  rememberChatScroll,
  resetChatScrollMemoryForTests,
  restoreChatScroll,
  revealStartForMemory,
  shouldRevealFast,
  sliceTurnsFrom,
  turnIndexContaining,
} from './thread-reveal.ts'

afterEach(() => {
  resetChatScrollMemoryForTests()
})

function user(id: string): ChatNode {
  return { id, kind: 'user', text: id }
}

function reply(id: string): ChatNode {
  return {
    id,
    kind: 'reply',
    parts: [{ id: `${id}-a`, kind: 'assistant', text: id }],
    copyText: id,
  }
}

function longThread(): ChatNode[] {
  const nodes: ChatNode[] = []
  for (let i = 0; i < 10; i += 1) {
    nodes.push(user(`u-${i}`), reply(`r-${i}`))
  }
  return nodes
}

describe('thread reveal (visible first, then older)', () => {
  it('first paint starts at the tail, not turn 0', () => {
    expect(firstPaintStartIndex(10)).toBe(10 - CHAT_FIRST_PAINT_TURNS)
    expect(firstPaintStartIndex(1)).toBe(0)
    expect(firstPaintStartIndex(0)).toBe(0)
  })

  it('sliceTurnsFrom keeps later turns mounted when start decreases', () => {
    const nodes = longThread()
    const tail = sliceTurnsFrom(nodes, 8)
    expect(tail.map((n) => n.id)).toEqual(['u-8', 'r-8', 'u-9', 'r-9'])
    const more = sliceTurnsFrom(nodes, bumpRevealStart(8, 2))
    expect(more.map((n) => n.id).slice(-4)).toEqual(['u-8', 'r-8', 'u-9', 'r-9'])
    expect(more[0]?.id).toBe('u-6')
  })

  it('new message at the end stays in the mounted slice without remounting earlier tail', () => {
    const nodes = [...longThread(), user('u-10'), reply('r-10')]
    const start = firstPaintStartIndex(10)
    const shown = sliceTurnsFrom(nodes, start)
    expect(shown.at(-2)?.id).toBe('u-10')
    expect(shown.some((n) => n.id === 'u-8')).toBe(true)
  })

  it('groupNodesIntoTurns still splits on user', () => {
    expect(groupNodesIntoTurns(longThread())).toHaveLength(10)
  })

  it('reveals fast when the tail does not fill the viewport', () => {
    expect(
      shouldRevealFast({ scrollTop: 2000, scrollHeight: 400, clientHeight: 800 }),
    ).toBe(true)
    expect(
      shouldRevealFast({ scrollTop: 2000, scrollHeight: 4000, clientHeight: 800 }),
    ).toBe(false)
    expect(
      shouldRevealFast({ scrollTop: 40, scrollHeight: 4000, clientHeight: 800 }),
    ).toBe(true)
  })
})

function box(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    bottom: top + height,
    left: 0,
    right: 400,
    width: 400,
    height,
    toJSON() {
      return {}
    },
  }
}

describe('chat scroll memory per session', () => {
  it('keeps an independent reading position for each session', () => {
    rememberChatScroll('s-a', { kind: 'anchor', nodeId: 'u-3', offset: 24 })
    rememberChatScroll('s-b', { kind: 'bottom' })
    expect(recalledChatScroll('s-a')).toEqual({ kind: 'anchor', nodeId: 'u-3', offset: 24 })
    expect(recalledChatScroll('s-b')).toEqual({ kind: 'bottom' })
  })

  it('mounts from the remembered turn instead of only the tail', () => {
    const nodes = longThread()
    expect(turnIndexContaining(nodes, 'u-3')).toBe(3)
    expect(revealStartForMemory(nodes, { kind: 'anchor', nodeId: 'u-3', offset: 12 }, 10)).toBe(3)
    expect(revealStartForMemory(nodes, { kind: 'bottom' }, 10)).toBe(10 - CHAT_FIRST_PAINT_TURNS)
  })

  it('captures the first visible node when not pinned to the bottom', () => {
    const parent = document.createElement('div')
    Object.defineProperty(parent, 'scrollHeight', { value: 4000, configurable: true })
    Object.defineProperty(parent, 'scrollTop', { value: 1200, writable: true, configurable: true })
    Object.defineProperty(parent, 'clientHeight', { value: 800, configurable: true })
    parent.getBoundingClientRect = () => box(0, 800)
    const above = document.createElement('div')
    above.dataset.nodeId = 'u-2'
    above.getBoundingClientRect = () => box(-80, 40)
    const visible = document.createElement('div')
    visible.dataset.nodeId = 'u-3'
    visible.getBoundingClientRect = () => box(40, 80)
    parent.append(above, visible)
    expect(captureChatScroll(parent)).toEqual({ kind: 'anchor', nodeId: 'u-3', offset: -40 })
  })

  it('captures bottom when close to the latest messages', () => {
    const parent = document.createElement('div')
    Object.defineProperty(parent, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(parent, 'scrollTop', { value: 1180, writable: true, configurable: true })
    Object.defineProperty(parent, 'clientHeight', { value: 800, configurable: true })
    expect(captureChatScroll(parent)).toEqual({ kind: 'bottom' })
  })

  it('restores the saved offset onto the same node', () => {
    const parent = document.createElement('div')
    Object.defineProperty(parent, 'scrollTop', { value: 500, writable: true, configurable: true })
    parent.getBoundingClientRect = () => box(0, 800)
    const row = document.createElement('div')
    row.dataset.nodeId = 'u-3'
    row.getBoundingClientRect = () => box(120, 80)
    parent.append(row)
    expect(restoreChatScroll(parent, { kind: 'anchor', nodeId: 'u-3', offset: -40 })).toBe(true)
    expect(parent.scrollTop).toBe(500 + 120 + -40)
  })
})
