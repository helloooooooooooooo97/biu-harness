/**
 * Cursor 式用户消息贴顶：data-chat-kind=user 的行应 sticky，
 * 下一条用户消息顶上来时由浏览器自动「换人」。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ChatNodeList } from './thread.tsx'
import type { ChatNode } from '../../infrastructure/session-project.ts'
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
  it('marks user rows with data-chat-kind=user for CSS sticky', () => {
    const onInspect = vi.fn()
    const onFork = vi.fn(async () => {})
    render(<ChatNodeList nodes={sampleNodes()} onInspect={onInspect} onFork={onFork} />)

    const userRows = document.querySelectorAll('[data-chat-kind="user"]')
    const replyRows = document.querySelectorAll('[data-chat-kind="reply"]')
    expect(userRows).toHaveLength(2)
    expect(replyRows).toHaveLength(2)
    expect(userRows[0]?.getAttribute('data-node-id')).toBe('u-1')
    expect(userRows[1]?.getAttribute('data-node-id')).toBe('u-2')
  })

  it('keeps user sticky markers after re-render (scroll-back safe)', () => {
    const nodes = sampleNodes()
    const onInspect = vi.fn()
    const onFork = vi.fn(async () => {})
    const { rerender } = render(<ChatNodeList nodes={nodes} onInspect={onInspect} onFork={onFork} />)
    rerender(<ChatNodeList nodes={nodes} onInspect={onInspect} onFork={onFork} />)
    expect(document.querySelectorAll('[data-chat-kind="user"]')).toHaveLength(2)
    expect(document.querySelector('[data-node-id="u-2"]')?.getAttribute('data-chat-kind')).toBe('user')
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
})
