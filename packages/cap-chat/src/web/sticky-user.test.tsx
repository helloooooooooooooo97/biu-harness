/**
 * Cursor 式用户消息贴顶：data-chat-kind=user 的行应 sticky，
 * 且包在 .chat-turn 里，同时只会有一条贴顶。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ChatNodeList, groupNodesIntoTurns } from './thread.tsx'
import type { ChatNode } from '@biu/web-session-view'
import { resetMarkdownRenderForTests } from './markdown-render.ts'

afterEach(() => {
  cleanup()
  resetMarkdownRenderForTests()
  vi.restoreAllMocks()
})

function sampleNodes(): ChatNode[] {
  return [
    { id: 'u-1', kind: 'user', text: 'first question', ts: Date.parse('2026-08-22T10:30:00') },
    {
      id: 'r-1',
      kind: 'reply',
      parts: [{ id: 'a-1', kind: 'assistant', text: 'first answer **md**' }],
      copyText: 'first answer **md**',
      durationMs: 10,
      stepCount: 2,
      turn: 1,
    },
    { id: 'u-2', kind: 'user', text: 'second question', ts: Date.parse('2026-08-22T11:05:00') },
    {
      id: 'r-2',
      kind: 'reply',
      parts: [{ id: 'a-2', kind: 'assistant', text: 'second answer' }],
      copyText: 'second answer',
      durationMs: 10,
      turn: 2,
    },
  ]
}

describe('sticky user message markers', () => {
  it('groups one user + following reply into a turn sticky container', () => {
    const turns = groupNodesIntoTurns(sampleNodes())
    expect(turns).toHaveLength(2)
    expect(turns[0]?.map((n) => n.id)).toEqual(['u-1', 'r-1'])
    expect(turns[1]?.map((n) => n.id)).toEqual(['u-2', 'r-2'])
  })

  it('marks user rows with data-chat-kind=user for CSS sticky', () => {
    const onInspect = vi.fn()
    const onFork = vi.fn(async () => {})
    render(<ChatNodeList nodes={sampleNodes()} onInspect={onInspect} onFork={onFork} />)

    const turns = document.querySelectorAll('[data-testid="chat-turn"]')
    const userRows = document.querySelectorAll('[data-chat-kind="user"]')
    const replyRows = document.querySelectorAll('[data-chat-kind="reply"]')
    expect(turns).toHaveLength(2)
    expect(userRows).toHaveLength(2)
    expect(replyRows).toHaveLength(2)
    expect(turns[0]?.querySelectorAll('[data-chat-kind="user"]')).toHaveLength(1)
    expect(turns[1]?.querySelectorAll('[data-chat-kind="user"]')).toHaveLength(1)
    expect(userRows[0]?.getAttribute('data-node-id')).toBe('u-1')
    expect(userRows[1]?.getAttribute('data-node-id')).toBe('u-2')
    expect(userRows[0]?.getAttribute('data-biu-kind')).toBe('message')
    expect(userRows[0]?.getAttribute('data-biu-id')).toBe('u-1')
    expect(document.querySelector('[data-testid="user-bubble"]')?.getAttribute('data-biu-kind')).toBe('message')
    expect(replyRows[0]?.getAttribute('data-biu-kind')).toBe('reply')
  })

  it('keeps user sticky markers after re-render (scroll-back safe)', () => {
    const nodes = sampleNodes()
    const onInspect = vi.fn()
    const onFork = vi.fn(async () => {})
    const { rerender } = render(<ChatNodeList nodes={nodes} onInspect={onInspect} onFork={onFork} />)
    rerender(<ChatNodeList nodes={nodes} onInspect={onInspect} onFork={onFork} />)
    expect(document.querySelectorAll('[data-chat-kind="user"]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-testid="chat-turn"]')).toHaveLength(2)
    expect(document.querySelector('[data-node-id="u-2"]')?.getAttribute('data-chat-kind')).toBe('user')
  })

  it('puts sender avatar left of sent time on the turn bar', () => {
    const onInspect = vi.fn()
    const onFork = vi.fn(async () => {})
    render(<ChatNodeList nodes={sampleNodes()} onInspect={onInspect} onFork={onFork} />)

    const bar = document.querySelector('[data-node-id="u-1"] [data-testid="user-turn-bar"]')
    const end = bar?.querySelector('[data-testid="user-turn-bar-end"]')
    const kids = end ? Array.from(end.children) : []
    const senderIdx = kids.findIndex((el) => el.getAttribute('data-testid') === 'user-sender-human')
    const timeIdx = kids.findIndex((el) => el.getAttribute('data-testid') === 'user-sent-at')
    expect(senderIdx).toBeGreaterThanOrEqual(0)
    expect(timeIdx).toBeGreaterThan(senderIdx)
    expect(document.querySelector('[data-testid="user-bubble"] [data-testid="user-sender-human"]')).toBeNull()
  })

  it('puts stats under user message; copy/fork stay on reply', () => {
    const onInspect = vi.fn()
    const onFork = vi.fn(async () => {})
    render(<ChatNodeList nodes={sampleNodes()} onInspect={onInspect} onFork={onFork} />)

    const user1 = document.querySelector('[data-node-id="u-1"]')
    const reply1 = document.querySelector('[data-node-id="r-1"]')
    expect(user1?.querySelector('[data-testid="user-turn-bar"]')).toBeTruthy()
    expect(user1?.querySelector('[data-testid="user-tool-count"]')?.textContent).toBe('0')
    expect(user1?.querySelector('[data-testid="user-sent-at"]')?.textContent).toMatch(/\d{1,2}:\d{2}/)
    expect(user1?.querySelector('[aria-label="回合操作"]')).toBeNull()
    expect(reply1?.querySelector('[aria-label="回合操作"]')).toBeTruthy()
    expect(document.querySelectorAll('.chat-reply-bar')).toHaveLength(0)
  })

  it('renders pick handles as chips in the user bubble', () => {
    const onInspect = vi.fn()
    const onFork = vi.fn(async () => {})
    render(
      <ChatNodeList
        nodes={[
          {
            id: 'u-pick',
            kind: 'user',
            text: '<pick kind="task" id="t1" action="open" route="/tasks" label="写需求" />\n处理这个',
            ts: 1,
          },
        ]}
        onInspect={onInspect}
        onFork={onFork}
      />,
    )
    const chips = document.querySelectorAll('[data-testid="user-pick-chip"]')
    expect(chips).toHaveLength(1)
    expect(chips[0]?.querySelector('[data-pick-kind="task"]')).toBeTruthy()
    expect(chips[0]?.textContent).toContain('写需求 · open')
    expect(document.querySelector('[data-testid="user-bubble"]')?.textContent).toContain('处理这个')
  })
})
