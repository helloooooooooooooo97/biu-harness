import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { CordisPluginManager } from './plugin-manager.ts'

// 本文件测 dsh 式插件安装与热更新：install/remove/reload/applyConfig/动态 import/插件热重载。

const helloPlugin: Plugin<unknown> = {
  name: 'hello',
  provide: 'greeting',
  apply(ctx: Context) {
    ctx.provide('greeting', 'hello')
  },
}

function manager(): CordisPluginManager {
  const ctx = new Context()
  const registry = new Map<string, Plugin<unknown>>()
  registry.set('hello', helloPlugin)
  return new CordisPluginManager(ctx, registry)
}

/** 轮询等待条件成立（watch 回调是异步 fire-and-forget，直接 sleep 有竞态）。 */
async function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (cond()) return resolve()
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor 超时'))
      setTimeout(tick, 20)
    }
    tick()
  })
}

test('install 注册并挂载，remove 卸载后服务消失', async () => {
  const m = manager()
  await m.install('hello', helloPlugin, 'greeter')
  assert.equal(m.ctx.get('greeting'), 'hello')
  assert.deepEqual(m.pluginNames(), ['hello'])
  await m.remove('greeter')
  assert.equal(m.ctx.get('greeting'), undefined)
  assert.deepEqual(m.pluginNames(), [])
})

test('install 不传 def 时经 resolver 动态 import() 插件模块', async () => {
  const ctx = new Context()
  const resolver = async (name: string): Promise<Plugin<unknown> | undefined> => (name === 'hello' ? helloPlugin : undefined)
  const m = new CordisPluginManager(ctx, undefined, resolver)
  await m.install('hello', undefined, 'greeter')
  assert.equal(m.ctx.get('greeting'), 'hello')
  assert.deepEqual(m.pluginNames(), ['hello'])
  await assert.rejects(() => m.install('ghost'), /未知插件: ghost/)
})

test('applyConfig 热增/热删/热换（HMR）', async () => {
  const m = manager()
  const loopV1: Plugin<unknown> = { name: 'loop-v1', provide: 'loop', apply(ctx) { ctx.provide('loop', 'v1') } }
  const loopV2: Plugin<unknown> = { name: 'loop-v2', provide: 'loop', apply(ctx) { ctx.provide('loop', 'v2') } }
  m.register('loop-v1', loopV1)
  m.register('loop-v2', loopV2)

  await m.applyConfig([{ id: 'loop', name: 'loop-v1' }, { id: 'h', name: 'hello' }])
  assert.equal(m.ctx.get('loop'), 'v1')
  assert.equal(m.ctx.get('greeting'), 'hello')

  // 热换：同名 id 换成另一个插件 → 卸载旧 fiber、挂新 fiber
  await m.applyConfig([{ id: 'loop', name: 'loop-v2' }, { id: 'h', name: 'hello' }])
  assert.equal(m.ctx.get('loop'), 'v2')

  // 热删：禁用 hello
  await m.applyConfig([{ id: 'loop', name: 'loop-v2' }, { id: 'h', name: 'hello', enabled: false }])
  assert.equal(m.ctx.get('greeting'), undefined)
})

test('reloadPlugin 破缓存重新 import 并重挂同名条目', async () => {
  const ctx = new Context()
  const resolver = async (_name: string, bust?: boolean): Promise<Plugin<unknown> | undefined> => {
    return bust
      ? { name: 'loop', provide: 'loop', apply(c: Context) { c.provide('loop', 'v2') } }
      : { name: 'loop', provide: 'loop', apply(c: Context) { c.provide('loop', 'v1') } }
  }
  const m = new CordisPluginManager(ctx, undefined, resolver)
  await m.install('loop', undefined, 'loop')
  assert.equal(m.ctx.get('loop'), 'v1')
  await m.reloadPlugin('loop')
  assert.equal(m.ctx.get('loop'), 'v2')
})

test('reload 卸掉再挂同一条目', async () => {
  const m = manager()
  await m.install('hello', helloPlugin, 'g')
  await m.reload('g')
  assert.equal(m.ctx.get('greeting'), 'hello')
})

test('apply 返回的 disposer 在卸载时执行', async () => {
  const ctx = new Context()
  const m = new CordisPluginManager(ctx)
  const order: string[] = []
  await m.install('section', {
    name: 'section',
    apply() {
      order.push('on')
      return () => order.push('off')
    },
  }, 'section')
  assert.deepEqual(order, ['on'])
  await m.remove('section')
  assert.deepEqual(order, ['on', 'off'])
})

test('fiber 卸载时 effect 逆序撤销', async () => {
  const ctx = new Context()
  const m = new CordisPluginManager(ctx)
  const order: string[] = []
  await m.install('stack', {
    name: 'stack',
    apply(c) {
      c.effect(() => {
        order.push('a-on')
        return () => order.push('a-off')
      }, 'a')
      c.effect(() => {
        order.push('b-on')
        return () => order.push('b-off')
      }, 'b')
    },
  }, 'stack')
  assert.deepEqual(order, ['a-on', 'b-on'])
  await m.remove('stack')
  assert.deepEqual(order, ['a-on', 'b-on', 'b-off', 'a-off'])
})

test('watchConfig 配置文件变化触发热更新', async () => {
  const m = manager()
  let text = '' // 初始为空，等文本变化才触发（watch 只响应变化）
  const stop = m.watchConfig(() => text, 30)
  try {
    text = JSON.stringify({ entries: [{ id: 'h', name: 'hello' }] })
    await waitFor(() => m.ctx.get('greeting') === 'hello')
    text = JSON.stringify({ entries: [{ id: 'h', name: 'hello', enabled: false }] })
    await waitFor(() => m.ctx.get('greeting') === undefined)
  } finally {
    stop() // 即使断言失败也要停掉轮询，否则进程挂住
  }
})

test('watchPlugins 检测插件文件 mtime 变化并热重载', async () => {
  const ctx = new Context()
  let mtimeMs = 1
  const resolver = async (_name: string, bust?: boolean): Promise<Plugin<unknown> | undefined> => ({
    name: 'loop',
    provide: 'loop',
    apply(c: Context) { c.provide('loop', bust ? 'v2' : 'v1') },
  })
  const m = new CordisPluginManager(ctx, undefined, resolver)
  await m.install('loop', undefined, 'loop')
  assert.equal(m.ctx.get('loop'), 'v1')
  const stop = m.watchPlugins(() => [{ name: 'loop', mtimeMs }], 30)
  try {
    mtimeMs = 2
    await waitFor(() => m.ctx.get('loop') === 'v2')
  } finally {
    stop()
  }
})
