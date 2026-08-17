import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EffectRegistry } from './effects.ts'

// 本文件测 EffectRegistry：① 注册即可逆；② disposer 幂等；③ disposeAll 逆序。

test('register 返回的 disposer 只执行一次', () => {
  // 验证幂等：重复调用 disposer 不会重复执行清理函数。
  const registry = new EffectRegistry()
  let ran = 0
  const off = registry.register(() => {
    ran += 1
  })
  off()
  off()
  assert.equal(ran, 1)
  assert.equal(registry.size, 0)
})

test('disposeAll 逆序释放全部', () => {
  // 验证逆序：后注册的先执行（依赖者先于被依赖者）。
  const registry = new EffectRegistry()
  const order: string[] = []
  registry.register(() => order.push('a'))
  registry.register(() => order.push('b'))
  registry.disposeAll()
  assert.deepEqual(order, ['b', 'a'])
  assert.equal(registry.size, 0)
})

test('手动 disposer 后 disposeAll 不会重复执行', () => {
  // 验证双保险：先手动卸载、再整体释放，清理只发生一次。
  const registry = new EffectRegistry()
  let ran = 0
  const off = registry.register(() => {
    ran += 1
  })
  off()
  registry.disposeAll()
  assert.equal(ran, 1)
})
