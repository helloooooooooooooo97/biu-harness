import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CompactionRunner, estimateTokens, PressureMonitor, pruneToolResult } from './compaction.ts'

// 本文件测压缩：① 估算；② 压力；③ 裁剪；④ 集成。

test('estimateTokens 与压力检测', () => {
  assert.equal(estimateTokens('abcd'), 1)
  const monitor = new PressureMonitor(4)
  assert.equal(monitor.overLimit([{ role: 'user', content: 'a'.repeat(30) }]), true)
  assert.equal(monitor.overLimit([{ role: 'user', content: 'hi' }]), false)
})

test('pruneToolResult 保留头尾并标记裁剪', () => {
  const text = 'a'.repeat(100)
  const pruned = pruneToolResult(text, 20)
  assert.ok(pruned.length < text.length)
  assert.match(pruned, /\[裁剪 80 字符\]/)
})

test('CompactionRunner 超限时压缩并发出 durable 事件', () => {
  const runner = new CompactionRunner(new PressureMonitor(4))
  const longTool = { role: 'tool', content: 'x'.repeat(100) }
  const input = [
    { role: 'user', content: 'q' },
    { role: 'assistant', content: 'a' },
    longTool,
  ]
  const result = runner.compact(input)
  assert.ok(result.events[0].kind === 'compaction/start')
  assert.ok(result.events.some((e) => e.kind === 'compaction/summary'))
  assert.equal(result.events.at(-1)?.kind, 'compaction/end')
  assert.ok(result.summary.length > 0)
  assert.ok(result.messages[0].role === 'system')
})
