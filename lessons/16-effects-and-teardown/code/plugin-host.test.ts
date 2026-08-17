import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PluginHost, type PluginDef } from './plugin-host.ts'

// 本文件测 PluginHost：① 加载/卸载清理；② reload 换实现；③ 失败回滚（服务 + 状态）。

test('load 提供服务，unload 清理 effect 与服务', () => {
  // 验证插件作用域：unload 后服务消失，插件计数归零。
  const host = new PluginHost()
  host.load({
    name: 'greeting',
    apply(ctx) {
      ctx.provide('greeting', 'hello')
    },
  })
  assert.equal(host.get<string>('greeting'), 'hello')
  host.unload('greeting')
  assert.equal(host.pluginCount, 0)
  assert.throws(() => host.get('greeting'), /缺少服务: greeting/)
})

test('reload 替换实现：服务值变化、版本递增', () => {
  // 验证热重载：同一插件名换 apply，新服务生效、version 变大。
  const host = new PluginHost()
  const v1 = host.load({
    name: 'greeting',
    apply(ctx) {
      ctx.provide('greeting', 'hello')
    },
  })
  const result = host.reload('greeting', {
    name: 'greeting',
    apply(ctx) {
      ctx.provide('greeting', 'hi')
    },
  })
  assert.equal(result.ok, true)
  assert.ok(result.ok && result.version > v1)
  assert.equal(host.get<string>('greeting'), 'hi')
})

test('reload 失败回滚：旧服务恢复、状态恢复', () => {
  // 验证三段式回滚：新 apply 改状态后抛错 → 服务回到旧值；
  // 外部状态（旧插件不写的 key）被快照恢复；旧插件重跑 apply 会写回它自己的状态。
  const host = new PluginHost()
  host.load({
    name: 'greeting',
    apply(ctx) {
      ctx.state.set('label', 'old-state')
      ctx.provide('greeting', 'hello')
    },
  })
  host.state.set('external', 'keep-me')

  const result = host.reload('greeting', {
    name: 'greeting',
    apply(ctx) {
      ctx.state.set('label', 'dirty')
      throw new Error('apply 失败')
    },
  })

  assert.equal(result.ok, false)
  assert.equal(host.get<string>('greeting'), 'hello')
  assert.equal(host.state.get<string>('label'), 'old-state')   // 旧 apply 重跑写回
  assert.equal(host.state.get<string>('external'), 'keep-me')  // 外部状态被快照保住
})

test('reload 未加载的插件抛错', () => {
  // 验证前置条件：只能 reload 已加载的插件。
  const host = new PluginHost()
  const def: PluginDef = { name: 'x', apply: () => {} }
  assert.throws(() => host.reload('x', def), /插件未加载: x/)
})
