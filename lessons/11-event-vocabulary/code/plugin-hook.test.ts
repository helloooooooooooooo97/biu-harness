import { test } from 'node:test'
import assert from 'node:assert/strict'
import './plugin-hook.ts' // 触发声明合并（副作用 import）
import { TypedEventBus } from './typed-bus.ts'

// 本文件验证声明合并：插件自定义事件（hook/invoked）可以被类型安全地 on/emit。

test('声明合并后，插件自定义事件可以类型安全地 on/emit', () => {
  // 运行层验证：合并后的事件能在 TypedEventBus 上正常收发（编译层由 tsc 验证签名）。
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
