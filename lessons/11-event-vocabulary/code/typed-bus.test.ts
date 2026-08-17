import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TypedEventBus } from './typed-bus.ts'

test('emit 按注册顺序通知所有监听器', () => {
  const bus = new TypedEventBus()
  const order: string[] = []
  bus.on('user/message', (data) => order.push(`a:${data.content}`))
  bus.on('user/message', (data) => order.push(`b:${data.content}`))
  bus.emit('user/message', { role: 'user', content: '你好' })
  assert.deepEqual(order, ['a:你好', 'b:你好'])
})

test('on 返回的 disposer 可以移除监听器', () => {
  const bus = new TypedEventBus()
  let count = 0
  const off = bus.on('tool/call', () => {
    count += 1
  })
  bus.emit('tool/call', { turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: '{}' })
  off()
  bus.emit('tool/call', { turn: 1, step: 1, callId: 'c2', name: 'bash', arguments: '{}' })
  assert.equal(count, 1)
  assert.equal(bus.listenerCount('tool/call'), 0)
})

test('负载类型在编译期校验（tsc 把关），运行时透传', () => {
  const bus = new TypedEventBus()
  const seen: unknown[] = []
  bus.on('assistant/message', (data) => seen.push(data))
  bus.emit('assistant/message', {
    turn: 1,
    step: 1,
    message: { role: 'assistant', content: [{ type: 'text', text: '你好！' }] },
    usage: { total_tokens: 12 },
  })
  assert.equal(seen.length, 1)
  const payload = seen[0] as { usage?: { total_tokens?: number } }
  assert.equal(payload.usage?.total_tokens, 12)
})
