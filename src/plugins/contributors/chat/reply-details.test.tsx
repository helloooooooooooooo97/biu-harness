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
    expect(screen.queryByText('thinking draft')).toBeNull()
    expect(screen.queryByText('read_file')).toBeNull()

    fireEvent.click(screen.getByTestId('details-toggle'))
    expect(screen.getByText('thinking draft')).toBeTruthy()
    expect(screen.getByText('read_file')).toBeTruthy()
  })
})
