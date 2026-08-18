import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CapabilityContext, CapabilityRegistry, MiniContext } from './index.ts'

// 本文件测 core-capability：注册表 + 一切皆插件组装。

test('CapabilityRegistry 注册与懒创建', () => {
  const registry = new CapabilityRegistry()
  let created = 0
  registry.register({
    definition: { key: 'llm', description: '模型调用' },
    create: () => {
      created += 1
      return { provider: 'deepseek' }
    },
  })
  assert.equal((registry.provide('llm') as { provider: string }).provider, 'deepseek')
  assert.equal(created, 1)
})

test('MiniContext：插件注册服务、卸载移除', () => {
  const ctx = new MiniContext()
  const unload = ctx.plugin({
    name: 'loop',
    apply(c) {
      c.provide('agentLoop', { run: () => 'v1' })
    },
  })
  assert.equal(ctx.get<{ run: () => string }>('agentLoop').run(), 'v1')
  unload()
  assert.equal(ctx.has('agentLoop'), false)
})

test('CapabilityContext：插件装载能力、卸载清理、换 Provider 消费者无感', () => {
  const ctx = new CapabilityContext()
  const consumer = () => ctx.get<{ run: () => string }>('agentLoop').run()

  const unloadV1 = ctx.plugin({
    name: 'loop-v1',
    apply(c) {
      c.mount({
        definition: { key: 'agentLoop', description: 'loop' },
        create: () => ({ run: () => 'v1' }),
      })
    },
  })
  assert.equal(consumer(), 'v1')
  unloadV1()

  ctx.plugin({
    name: 'loop-v2',
    apply(c) {
      c.mount({
        definition: { key: 'agentLoop', description: 'loop' },
        create: () => ({ run: () => 'v2' }),
      })
    },
  })
  assert.equal(consumer(), 'v2')
  assert.ok(ctx.has('prompt') === false)
})
