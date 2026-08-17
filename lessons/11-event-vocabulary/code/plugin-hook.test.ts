import { test } from 'node:test'
import assert from 'node:assert/strict'
import './plugin-hook.ts' // 触发声明合并（副作用 import）
import { TypedEventBus } from './typed-bus.ts'

test('声明合并后，插件自定义事件可以类型安全地 on/emit', () => {
  const bus = new TypedEventBus()
  const seen: unknown[] = []
  bus.on('hook/invoked', (data) => seen.push(data))
  bus.emit('hook/invoked', {
    hook: 'pre-step',
    args: { messages: [] },
    at: '2026-08-17T00:00:00Z',
  })
  assert.equal(seen.length, 1)
  const payload = seen[0] as { hook: string }
  assert.equal(payload.hook, 'pre-step')
})
