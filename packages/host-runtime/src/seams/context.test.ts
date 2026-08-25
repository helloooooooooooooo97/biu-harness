import { describe, it, expect } from 'vitest'
import { buildBrief, retrieveHistory, lastUsageBeforeCompact } from './context.ts'
import type { SessionEvent } from '../core/session-types.ts'

function ev(partial: Partial<SessionEvent> & { type: SessionEvent['type'] }): SessionEvent {
  return partial as SessionEvent
}

describe('compact 辅助函数', () => {
  it('buildBrief 统计事件构成并收集最近要点', () => {
    const events: SessionEvent[] = [
      ev({ type: 'user/message', text: '你好，帮我看看任务面板', seq: 1, ts: 1 }),
      ev({ type: 'assistant/message', text: '好的，当前有 5 个任务', seq: 2, ts: 2 }),
      ev({ type: 'tool/result', id: 't1', name: 'tasks_list', ok: true, detail: '{...}', seq: 3, ts: 3 }),
      ev({ type: 'user/message', text: '继续优化 compact', seq: 4, ts: 4 }),
    ]
    const { brief, stats } = buildBrief(events)
    expect(stats['user/message']).toBe(2)
    expect(stats['assistant/message']).toBe(1)
    expect(stats['tool/result']).toBe(1)
    expect(brief).toContain('任务面板')
    expect(brief).toContain('compact')
  })

  it('retrieveHistory 按关键词返回相关片段', () => {
    const events: SessionEvent[] = [
      ev({ type: 'user/message', text: '我们要重构会话的滑动窗口逻辑', seq: 1, ts: 1 }),
      ev({ type: 'assistant/message', text: '好的，调研压缩策略的根因', seq: 2, ts: 2 }),
      ev({ type: 'user/message', text: '窗口预算设成多少合适', seq: 3, ts: 3 }),
    ]
    const hits = retrieveHistory(events, '滑动窗口', 5)
    expect(hits.length).toBeGreaterThan(0)
    // 命中的第一条应含关键词
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
        name: 'context_compact_submit',
        arguments: JSON.stringify({ text: '[摘要]' }),
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
    // 取压缩点之后最近一次调用，而非压缩前更大的 9000
    expect(u.inputTokens).toBe(120)
  })
})
