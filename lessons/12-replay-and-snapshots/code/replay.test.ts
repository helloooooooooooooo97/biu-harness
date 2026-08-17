import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SessionLog, type SessionEvent } from './session.ts'
import { parseJsonl, ReplayEngine } from './replay.ts'

// 本文件测 ReplayEngine + golden transcript：
//   ①/② golden 校验通过；③ 篡改失败；④ seq 完整性；⑤ snapshot 重放推导；⑥ parseJsonl 容错。

const goldenDir = new URL('./fixtures/golden/', import.meta.url).pathname

function golden(name: string): { eventsPath: string; expectedPath: string } {
  return {
    eventsPath: `${goldenDir}/${name}.jsonl`,
    expectedPath: `${goldenDir}/${name}.messages.json`,
  }
}

test('tool-loop golden 校验通过', () => {
  // 验证标准会话（单工具调用）的推导结果与期望 messages 逐字节一致。
  const engine = new ReplayEngine()
  const g = golden('tool-loop')
  const { events, expected } = engine.loadGolden(g.eventsPath, g.expectedPath)
  assert.ok(engine.verifyGolden(events, expected))
})

test('multi-step golden 校验通过（3 个 step 的连续推导）', () => {
  // 验证更长的标准会话（3 个 step、2 次工具调用）也能连续推导一致。
  const engine = new ReplayEngine()
  const g = golden('multi-step')
  const { events, expected } = engine.loadGolden(g.eventsPath, g.expectedPath)
  assert.equal(engine.verifyGolden(events, expected), true)
})

test('篡改日志后 golden 校验失败', () => {
  // 验证基准的敏感性：改掉 tool/result 内容后 verifyGolden 必须返回 false。
  const engine = new ReplayEngine()
  const g = golden('tool-loop')
  const { events, expected } = engine.loadGolden(g.eventsPath, g.expectedPath)
  const tampered = events.map((e) => (
    e.kind === 'tool/result'
      ? { ...e, data: { ...e.data, message: { role: 'tool', content: [{ type: 'text', text: '被篡改' }] } } }
      : e
  ))
  assert.equal(engine.verifyGolden(tampered, expected), false)
})

test('seq 不连续时抛错', () => {
  // 验证完整性检查：seq 出现缺口（1,3）时 assertContiguous 抛错，拒绝带病重放。
  const engine = new ReplayEngine()
  const events: SessionEvent[] = [
    { seq: 1, time: 't', kind: 'turn/start', data: { turn: 1 } },
    { seq: 3, time: 't', kind: 'user/message', data: { content: 'hi' } },
  ]
  assert.throws(() => engine.assertContiguous(events), /seq 不连续/)
})

test('replay(snapshot) 恢复事件并推导消息', () => {
  // 验证完整重放链路：snapshot → 恢复事件 → 校验 → 推导出 user/assistant 两条消息。
  const log = new SessionLog()
  log.append('user/message', { role: 'user', content: '你好' })
  log.append('assistant/message', {
    message: { role: 'assistant', content: [{ type: 'text', text: '你好！' }] },
  })
  const engine = new ReplayEngine()
  const result = engine.replay(log.snapshot())
  assert.equal(result.events.length, 2)
  assert.deepEqual(
    result.messages.map((m) => m.role),
    ['user', 'assistant'],
  )
})

test('parseJsonl 逐行解析且兼容坏行前的正常行', () => {
  // 验证解析容错：坏行被标记为 unparsed 事件，不中断后续解析。
  const events = parseJsonl('{"seq":1,"kind":"turn/start","data":{"turn":1}}\nnot-json\n')
  assert.equal(events.length, 2)
  assert.equal(events[0].kind, 'turn/start')
  assert.equal(events[1].kind, 'unparsed')
})
