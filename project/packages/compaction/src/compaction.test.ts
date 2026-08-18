import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CompactionRunner, PressureMonitor, pruneToolResult } from './index.ts'

// 本文件测压缩：压力、裁剪、durable 事件。

test('压力检测与裁剪', () => {
  const monitor = new PressureMonitor(4)
  assert.equal(monitor.overLimit([{ role: 'user', content: 'a'.repeat(30) }]), true)
  const pruned = pruneToolResult('a'.repeat(100), 20)
  assert.match(pruned, /\[裁剪 80 字符\]/)
})

test('CompactionRunner 超限时压缩并发出事件', () => {
  const runner = new CompactionRunner(new PressureMonitor(4))
  const result = runner.compact([
    { role: 'user', content: 'q' },
    { role: 'tool', content: 'x'.repeat(100) },
  ])
  assert.equal(result.events[0].kind, 'compaction/start')
  assert.ok(result.events.some((e) => e.kind === 'compaction/summary'))
  assert.equal(result.events.at(-1)?.kind, 'compaction/end')
  assert.ok(result.summary.length > 0)
})
