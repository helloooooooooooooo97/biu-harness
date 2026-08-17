import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EVENT_MODES, type EventKind, type EventMode } from './events.ts'

test('词汇表包含全部核心会话事件', () => {
  const kinds = [
    'turn/start',
    'turn/end',
    'step/start',
    'step/end',
    'user/message',
    'assistant/chunk',
    'assistant/message',
    'tool/call',
    'tool/result',
    'todo/write',
  ] as const
  for (const kind of kinds) {
    assert.ok(kind in EVENT_MODES, `缺少 ${kind}`)
  }
})

test('每个事件都有合法的调度模式', () => {
  const modes: EventMode[] = ['emit', 'waterfall', 'parallel', 'serial']
  for (const kind of Object.keys(EVENT_MODES) as EventKind[]) {
    assert.ok(modes.includes(EVENT_MODES[kind] as EventMode), `${kind} 的模式非法`)
  }
})

test('EVENT_MODES 覆盖的键与词汇表一致', () => {
  const keys = Object.keys(EVENT_MODES)
  assert.equal(keys.length, 10)
})
