import { describe, expect, it } from 'vitest'
import type { ChatNode } from '@biu/web-session-view'
import {
  bumpRevealStart,
  CHAT_FIRST_PAINT_TURNS,
  firstPaintStartIndex,
  groupNodesIntoTurns,
  shouldRevealFast,
  sliceTurnsFrom,
} from './thread-reveal.ts'

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
