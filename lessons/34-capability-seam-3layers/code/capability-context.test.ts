import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CapabilityContext } from './capability-context.ts'

// 本文件测一体化实现：插件装载能力 + 能力缝可替换 + 卸载清理。

test('插件 mount 能力缝，消费者懒取实例，卸载后消失', () => {
  const ctx = new CapabilityContext()
  let created = 0
  ctx.plugin({
    name: 'llm',
    apply(c) {
      c.mount({
        definition: { key: 'llm', description: '模型调用' },
        create: () => {
          created += 1
          return { chat: () => 'deepseek' }
        },
      })
    },
  })
  assert.equal(ctx.get<{ chat: () => string }>('llm').chat(), 'deepseek')
  assert.equal(created, 1)
  const unload = ctx.plugin({
    name: 'llm2',
    apply(c) {
      c.mount({
        definition: { key: 'llm2', description: '第二个模型' },
        create: () => ({ chat: () => 'mock' }),
      })
    },
  })
  unload()
  assert.equal(ctx.has('llm2'), false)
})

test('换 Provider：卸载旧插件、挂新插件，消费者无感', () => {
  const ctx = new CapabilityContext()
  const consumer = () => ctx.get<{ run: () => string }>('agentLoop').run()

  const unloadV1 = ctx.plugin({
    name: 'loop-v1',
    apply(c) {
      c.mount({
        definition: { key: 'agentLoop', description: 'loop 驱动' },
        create: () => ({ run: () => 'v1' }),
      })
    },
  })
  assert.equal(consumer(), 'v1')

  unloadV1()   // 先卸载旧插件（清掉 agentLoop 能力）
  ctx.plugin({
    name: 'loop-v2',
    apply(c) {
      c.mount({
        definition: { key: 'agentLoop', description: 'loop 驱动' },
        create: () => ({ run: () => 'v2' }),
      })
    },
  })
  assert.equal(consumer(), 'v2')
})

test('同一个 key 不能同时 mount 和 provide', () => {
  const ctx = new CapabilityContext()
  ctx.provide('tools', { list: () => [] })
  assert.throws(
    () => ctx.mount({ definition: { key: 'tools', description: 'x' }, create: () => ({}) }),
    /能力已存在: tools/,
  )
})

test('一个插件 mount 多个能力，卸载时全部清理', () => {
  const ctx = new CapabilityContext()
  const unload = ctx.plugin({
    name: 'bundle',
    apply(c) {
      c.provide('prompt', { section: '- echo' })
      c.mount({
        definition: { key: 'tools', description: '工具' },
        create: () => ({ list: () => ['echo'] }),
      })
    },
  })
  assert.ok(ctx.has('prompt'))
  assert.ok(ctx.has('tools'))
  unload()
  assert.equal(ctx.has('prompt'), false)
  assert.equal(ctx.has('tools'), false)
})
