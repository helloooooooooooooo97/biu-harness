import { describe, it, expect } from 'vitest'
import { retrieveHistory, lastUsageBeforeCompact } from './index.ts'
import type { SessionEvent } from '@biu/type-session'

function ev(partial: Partial<SessionEvent> & { type: SessionEvent['type'] }): SessionEvent {
  return partial as SessionEvent
}

describe('compact 辅助函数', () => {
  it('retrieveHistory 按关键词返回相关片段', () => {
    const events: SessionEvent[] = [
      ev({ type: 'user/message', text: '我们要重构会话的滑动窗口逻辑', seq: 1, ts: 1 }),
      ev({ type: 'assistant/message', text: '好的，调研压缩策略的根因', seq: 2, ts: 2 }),
      ev({ type: 'user/message', text: '窗口预算设成多少合适', seq: 3, ts: 3 }),
    ]
    const hits = retrieveHistory(events, '滑动窗口', 5)
    expect(hits.length).toBeGreaterThan(0)
    const first = hits[0]!
    expect(first.text).toMatch(/滑动窗口/)
  })

  it('lastUsageBeforeCompact 直接取压缩点之前最近一次调用的 inputTokens，不累加', () => {
    const events: SessionEvent[] = [
      ev({
        type: 'assistant/message',
        text: '第三次调用（更大）',
        seq: 5,
        ts: 5,
        usage: { inputTokens: 9000, outputTokens: 100, totalTokens: 9100 },
      }),
      ev({
        type: 'tool/call',
        id: 't1',
        name: 'db_action',
        arguments: JSON.stringify({
          path: '/sessions/s1',
          action: 'compact',
          args: { text: '[摘要]' },
        }),
        seq: 6,
        ts: 6,
      }),
      ev({
        type: 'assistant/message',
        text: '压缩后第一次调用（重置后的较小输入）',
        seq: 7,
        ts: 7,
        usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
      }),
    ]
    const u = lastUsageBeforeCompact(events)
    expect(u.found).toBe(true)
    expect(u.inputTokens).toBe(120)
  })
})
