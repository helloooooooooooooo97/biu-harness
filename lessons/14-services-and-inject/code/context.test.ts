import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from './context.ts'

// 本文件测精简版 Context（服务容器）：① 注册/取/卸载；② 重复注册；③ stop 清空。

test('provide/get/has 与卸载器', () => {
  // 验证服务注册、按名取值、disposer 卸载后服务消失。
  const ctx = new Context()
  const off = ctx.provide('config', { apiKey: 'sk' })
  assert.equal(ctx.get<{ apiKey: string }>('config').apiKey, 'sk')
  assert.ok(ctx.has('config'))
  off()
  assert.equal(ctx.has('config'), false)
})

test('重复 provide 抛错', () => {
  // 验证服务名唯一性：同 key 二次注册抛错。
  const ctx = new Context()
  ctx.provide('a', 1)
  assert.throws(() => ctx.provide('a', 2), /服务已存在: a/)
})

test('stop 逆序清空全部服务', () => {
  // 验证停机后服务列表清空（逆序卸载，依赖者先于被依赖者）。
  const ctx = new Context()
  ctx.provide('a', 1)
  ctx.provide('b', 2)
  ctx.stop()
  assert.deepEqual(ctx.serviceNames, [])
})
