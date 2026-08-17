import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from './context.ts'

test('provide/get/has 基本服务注册', () => {
  const ctx = new Context()
  const off = ctx.provide('greeting', 'hello')
  assert.equal(ctx.get<string>('greeting'), 'hello')
  assert.equal(ctx.has('greeting'), true)
  off()
  assert.equal(ctx.has('greeting'), false)
  assert.throws(() => ctx.get('greeting'), /缺少服务: greeting/)
})

test('重复 provide 抛错', () => {
  const ctx = new Context()
  ctx.provide('a', 1)
  assert.throws(() => ctx.provide('a', 2), /服务已存在: a/)
})

test('effect 手动卸载器只执行一次', () => {
  const ctx = new Context()
  let ran = 0
  const off = ctx.effect(() => {
    ran += 1
  })
  off()
  off()
  assert.equal(ran, 1)
})

test('plugin 加载后 apply 生效，卸载时清理', () => {
  const ctx = new Context()
  const values: string[] = []
  const unload = ctx.plugin({
    name: 'collector',
    apply() {
      values.push('apply')
      ctx.effect(() => {
        values.push('effect-cleanup')
      })
      return () => values.push('cleanup')
    },
  })
  assert.deepEqual(values, ['apply'])
  unload()
  assert.deepEqual(values, ['apply', 'effect-cleanup', 'cleanup'])
  assert.equal(ctx.pluginCount, 0)
})

test('重复加载同名插件抛错', () => {
  const ctx = new Context()
  const def = { name: 'x', apply: () => {} }
  ctx.plugin(def)
  assert.throws(() => ctx.plugin(def), /插件已加载: x/)
})

test('stop 逆序卸载全部插件并清空服务', () => {
  const ctx = new Context()
  const order: string[] = []
  ctx.plugin({
    name: 'first',
    apply() {
      order.push('first-apply')
      ctx.provide('first', 1)
      return () => order.push('first-cleanup')
    },
  })
  ctx.plugin({
    name: 'second',
    apply() {
      order.push('second-apply')
      ctx.provide('second', 2)
      return () => order.push('second-cleanup')
    },
  })
  ctx.stop()
  assert.deepEqual(order, ['first-apply', 'second-apply', 'second-cleanup', 'first-cleanup'])
  assert.equal(ctx.has('first'), false)
  assert.equal(ctx.has('second'), false)
  assert.equal(ctx.pluginCount, 0)
})
