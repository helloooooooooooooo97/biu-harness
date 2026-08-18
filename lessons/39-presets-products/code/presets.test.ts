import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IsolateRegistry } from './isolate.ts'
import { PresetRegistry } from './presets.ts'

// 本文件测产品配方：① preset 解析与回退；② 隔离域；③ 产品切换。

test('resolve 命中 preset，未命中落默认', () => {
  const registry = new PresetRegistry({ name: 'default', tools: ['echo'] })
  registry.register({ name: 'coding', tools: ['bash', 'fs'], prompt: '编码助手' })
  assert.deepEqual(registry.resolve('coding').tools, ['bash', 'fs'])
  assert.deepEqual(registry.resolve('nope').tools, ['echo'])
})

test('isolate：两个 realm 的同一 key 互不可见', () => {
  const isolate = new IsolateRegistry()
  isolate.provide('agent-a', 'tools', { owner: 'a' })
  isolate.provide('agent-b', 'tools', { owner: 'b' })
  assert.equal(isolate.get<{ owner: string }>('agent-a', 'tools').owner, 'a')
  assert.equal(isolate.get<{ owner: string }>('agent-b', 'tools').owner, 'b')
  assert.throws(() => isolate.get('agent-c', 'tools'), /缺少服务/)
})

test('全局服务作为所有 realm 的 fallback', () => {
  const isolate = new IsolateRegistry()
  isolate.provideGlobal('clock', { now: 0 })
  assert.equal(isolate.get<{ now: number }>('agent-a', 'clock').now, 0)
  isolate.provide('agent-a', 'clock', { now: 1 })
  assert.equal(isolate.get<{ now: number }>('agent-a', 'clock').now, 1)
})

test('同一套代码，两个 agent 用不同 preset', () => {
  const presets = new PresetRegistry({ name: 'default', tools: ['echo'] })
  presets.register({ name: 'coding', tools: ['bash', 'fs'] })
  assert.deepEqual(presets.resolve('coding').tools, ['bash', 'fs'])
  assert.deepEqual(presets.resolve(undefined).tools, ['echo'])
})
