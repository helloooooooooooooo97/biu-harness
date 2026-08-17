import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from './context.ts'

// 本文件测 mini-Cordis 内核 Context：① 服务注册；② 重复 provide；③ effect 卸载器；④ 插件作用域；⑤ 同名插件；⑥ stop 逆序。

test('provide/get/has 基本服务注册', () => {
  // 验证 provide 注册后 get/has 可用，disposer 调用后服务被移除、get 抛"缺少服务"。
  const ctx = new Context()
  const off = ctx.provide('greeting', 'hello')
  assert.equal(ctx.get<string>('greeting'), 'hello')
  assert.equal(ctx.has('greeting'), true)
  off()
  assert.equal(ctx.has('greeting'), false)
  assert.throws(() => ctx.get('greeting'), /缺少服务: greeting/)
})

test('重复 provide 抛错', () => {
  // 验证服务名唯一性：同 key 二次 provide 抛错，避免静默覆盖。
  const ctx = new Context()
  ctx.provide('a', 1)
  assert.throws(() => ctx.provide('a', 2), /服务已存在: a/)
})

// effect中的函数只会被执行一次，即便多次调用也只会被执行一次
test('effect 手动卸载器只执行一次', () => {
  // 验证可逆 effect：disposer 重复调用只执行一次清理（防重复卸载）。
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
  // 验证插件作用域：apply 里注册的 effect 在卸载时先逆序执行，再执行返回的 cleanup。
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
  // 验证插件名唯一性：同名插件二次加载抛错。
  const ctx = new Context()
  const def = { name: 'x', apply: () => { } }
  ctx.plugin(def)
  assert.throws(() => ctx.plugin(def), /插件已加载: x/)
})

test('stop 逆序卸载全部插件并清空服务', () => {
  // 验证整体停机：后加载的插件先卸载（cleanup 顺序 second → first），服务全部消失。
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

test('外部 effect 与插件内 effect 互不干扰：卸载插件不波及外部 effect', () => {
  // 验证归属：插件 apply 之外注册的 effect 只属于 context，插件卸载不碰它。
  const ctx = new Context()
  let externalRan = 0
  let pluginRan = 0
  ctx.effect(() => {
    externalRan += 1
  })
  ctx.plugin({
    name: 'p',
    apply() {
      ctx.effect(() => {
        pluginRan += 1
      })
    },
  })
  ctx.unload('p')
  assert.equal(pluginRan, 1)      // 插件自己的 effect 被清理
  assert.equal(externalRan, 0)    // 外部 effect 没被误清
  ctx.stop()
  assert.equal(externalRan, 1)    // 外部 effect 由 stop 清理
})

test('插件之后注册的外部 effect 不被该插件卸载波及（回归）', () => {
  // 验证修复：旧实现按"下标区间"清理会把插件之后的 effect 一起扫掉。
  const ctx = new Context()
  let externalRan = 0
  ctx.plugin({
    name: 'p',
    apply() {
      ctx.effect(() => {
        // 插件内 effect（内容无关，只占位）
      })
    },
  })
  ctx.effect(() => {
    externalRan += 1
  })
  ctx.unload('p')
  assert.equal(externalRan, 0)    // 外部 effect 仍在，未被波及
  ctx.stop()
  assert.equal(externalRan, 1)    // stop 时才清理
})

test('stop 先逆序卸载插件，再清理外部 effect', () => {
  // 验证 stop 的两段式顺序：插件（含其 effect）先，外部 effect 后。
  const ctx = new Context()
  const order: string[] = []
  ctx.effect(() => order.push('external'))
  ctx.plugin({
    name: 'p',
    apply() {
      ctx.effect(() => order.push('plugin'))
    },
  })
  ctx.stop()
  assert.deepEqual(order, ['plugin', 'external'])
})
