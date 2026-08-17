import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from './context.ts'

test('provide/get/has 与卸载器', () => {
  const ctx = new Context()
  const off = ctx.provide('config', { apiKey: 'sk' })
  assert.equal(ctx.get<{ apiKey: string }>('config').apiKey, 'sk')
  assert.ok(ctx.has('config'))
  off()
  assert.equal(ctx.has('config'), false)
})

test('重复 provide 抛错', () => {
  const ctx = new Context()
  ctx.provide('a', 1)
  assert.throws(() => ctx.provide('a', 2), /服务已存在: a/)
})

test('stop 逆序清空全部服务', () => {
  const ctx = new Context()
  ctx.provide('a', 1)
  ctx.provide('b', 2)
  ctx.stop()
  assert.deepEqual(ctx.serviceNames, [])
})
