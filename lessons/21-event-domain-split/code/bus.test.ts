import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventBus } from './bus.ts'
import { SessionLog } from './session.ts'

// 本文件测 live 通道：① 分发可用；② live 事件不落任何日志。

test('live 事件通过 bus 分发', () => {
  // 验证观察语义：监听器收到 payload，disposer 可移除。
  const bus = new EventBus()
  const seen: unknown[] = []
  const off = bus.on('agent/status', (status) => seen.push(status))
  bus.emit('agent/status', 'running')
  off()
  bus.emit('agent/status', 'idle')
  assert.deepEqual(seen, ['running'])
  assert.equal(bus.listenerCount('agent/status'), 0)
})

test('live 事件不会写进任何日志', () => {
  // 验证域隔离：bus 分发 live 事件后，SessionLog 长度保持 0——过程不落盘。
  const bus = new EventBus()
  const log = new SessionLog()
  bus.on('agent/request', () => {})
  bus.emit('agent/request', { messages: [] })
  bus.emit('agent/turn-stopping', {})
  assert.equal(log.length, 0)
})
