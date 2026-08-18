import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IsolateRegistry, PresetRegistry } from './index.ts'

// 本文件测产品配方：preset 回退与隔离域。

test('resolve 命中 preset，未命中落默认', () => {
  const registry = new PresetRegistry({ name: 'default', tools: ['echo'] })
  registry.register({ name: 'coding', tools: ['bash', 'fs'] })
  assert.deepEqual(registry.resolve('coding').tools, ['bash', 'fs'])
  assert.deepEqual(registry.resolve('nope').tools, ['echo'])
})

test('isolate 两个 realm 的同一 key 互不可见', () => {
  const isolate = new IsolateRegistry()
  isolate.provide('a', 'tools', { owner: 'a' })
  isolate.provide('b', 'tools', { owner: 'b' })
  assert.equal(isolate.get<{ owner: string }>('a', 'tools').owner, 'a')
  assert.equal(isolate.get<{ owner: string }>('b', 'tools').owner, 'b')
})
