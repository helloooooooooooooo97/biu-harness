import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CapabilityRegistry, type ServiceDefinition, type ServiceProvider } from './capability-seam.ts'

// 本文件测能力缝：① 注册/懒创建；② 重名/缺失；③ 换 Provider 消费者不变。

const llmDef: ServiceDefinition = { key: 'llm', description: '模型调用' }

test('registry 注册/懒创建/重名/缺失', () => {
  const registry = new CapabilityRegistry()
  let created = 0
  registry.register({
    definition: llmDef,
    create: () => {
      created += 1
      return { provider: 'deepseek' }
    },
  })
  assert.equal((registry.provide('llm') as { provider: string }).provider, 'deepseek')
  assert.equal(created, 1)   // 懒创建：只建一次
  assert.throws(() => registry.register({ definition: llmDef, create: () => ({}) }), /能力已存在/)
  assert.throws(() => registry.provide('nope'), /缺少能力/)
})

test('同一 definition 换 Provider，Consumer 代码不变', () => {
  const deepseek: ServiceProvider = { definition: llmDef, create: () => ({ chat: () => 'deepseek 回复' }) }
  const mock: ServiceProvider = { definition: llmDef, create: () => ({ chat: () => 'mock 回复' }) }

  const consumer = (registry: CapabilityRegistry) => (registry.provide('llm') as { chat: () => string }).chat()

  const a = new CapabilityRegistry()
  a.register(deepseek)
  assert.equal(consumer(a), 'deepseek 回复')

  const b = new CapabilityRegistry()
  b.register(mock)
  assert.equal(consumer(b), 'mock 回复')   // Consumer 一字未改
})
