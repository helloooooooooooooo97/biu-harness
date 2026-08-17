import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EVENT_MODES, type EventKind, type EventMode } from './events.ts'

// 本文件测事件词汇表与模式元数据：① 核心事件齐全；② 模式合法；③ 键数量与词汇表一致。

test('词汇表包含全部核心会话事件', () => {
  // 验证 10 个核心事件都登记在 EVENT_MODES 里（词汇表 = 模式的键集）。
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
  // 验证每个事件的 mode 必须是 emit/waterfall/parallel/serial 之一。
  const modes: EventMode[] = ['emit', 'waterfall', 'parallel', 'serial']
  for (const kind of Object.keys(EVENT_MODES) as EventKind[]) {
    assert.ok(modes.includes(EVENT_MODES[kind] as EventMode), `${kind} 的模式非法`)
  }
})

test('EVENT_MODES 覆盖的键与词汇表一致', () => {
  // 验证核心词汇表恰好 10 个键（声明合并新增的事件由插件自己补充，不在这 10 个里）。
  const keys = Object.keys(EVENT_MODES)
  assert.equal(keys.length, 10)
})
