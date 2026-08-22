import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ChatNodeList, splitReplyForDisplay } from './thread.tsx'
import type { ChatNode } from '../../infrastructure/session-project.ts'
import { resetMarkdownRenderForTests } from './markdown-render.ts'

afterEach(() => {
  cleanup()
  resetMarkdownRenderForTests()
  vi.restoreAllMocks()
})

function loopReply(): Extract<ChatNode, { kind: 'reply' }> {
  return {
    id: 'r-1',
    kind: 'reply',
    copyText: 'final answer here',
    durationMs: 1200,
    stepCount: 2,
    turn: 1,
    steps: [
      { step: 0, inputTokens: 10, outputTokens: 20, toolCount: 1, messageChars: 14 },
      { step: 1, inputTokens: 30, outputTokens: 40, toolCount: 0, messageChars: 17 },
    ],
    parts: [
      { id: 'a-draft', kind: 'assistant', text: 'thinking draft', step: 0 },
      {
        id: 't-1',
        kind: 'tool',
        name: 'read_file',
        callId: 'c1',
        arguments: '{}',
        step: 0,
        result: { ok: true, detail: 'ok' },
      },
      { id: 'a-final', kind: 'assistant', text: 'final answer here', step: 1 },
    ],
  }
}

describe('splitReplyForDisplay', () => {
  it('treats last assistant text as final Message; earlier parts as details', () => {
    const split = splitReplyForDisplay(loopReply())
    expect(split.hasDetails).toBe(true)
    expect(split.finalParts).toHaveLength(1)
    expect(split.finalParts[0]).toMatchObject({ id: 'a-final', kind: 'assistant' })
    expect(split.detailParts.map((part) => part.id)).toEqual(['a-draft', 't-1'])
  })

  it('has no details when reply is a single assistant message', () => {
    const split = splitReplyForDisplay({
      id: 'r-solo',
      kind: 'reply',
      copyText: 'only',
      parts: [{ id: 'a-1', kind: 'assistant', text: 'only' }],
    })
    expect(split.hasDetails).toBe(false)
    expect(split.finalParts).toHaveLength(1)
  })
})

describe('Details collapse UI', () => {
  it('defaults to final message only; Details expands tools/steps', () => {
    const nodes: ChatNode[] = [{ id: 'u-1', kind: 'user', text: 'do the thing' }, loopReply()]
    const onInspect = vi.fn()
    const onFork = vi.fn(async () => {})
    render(<ChatNodeList nodes={nodes} onInspect={onInspect} onFork={onFork} />)

    expect(screen.getByTestId('details-toggle')).toBeTruthy()
    expect(screen.getByText('final answer here')).toBeTruthy()
    // 折叠时不展示最终 step 统计
    expect(screen.queryByRole('group', { name: 'Step 2' })).toBeNull()
    // 折叠时 Details 仍挂在 DOM（hidden），避免展开重建
    const details = screen.getByTestId('reply-details')
    expect(details).toHaveProperty('hidden', true)
    expect(details.textContent).toContain('thinking draft')

    fireEvent.click(screen.getByTestId('details-toggle'))
    expect(screen.getByTestId('reply-details')).toHaveProperty('hidden', false)
    expect(screen.getByText('read_file')).toBeTruthy()
    expect(screen.getByTestId('user-tool-count').textContent).toBe('1')
    // 展开后最终 Message 所在 step 的统计也要有
    expect(screen.getByRole('group', { name: 'Step 2' })).toBeTruthy()
  })
})
