import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MiniContext } from './plugin-host.ts'

// 本文件测一切皆插件实操：① 三插件组装；② 换 loop 插件；③ 卸载后服务消失。

test('tools/prompt/loop 三个插件注册进 ctx 并按 key 取用', () => {
  const ctx = new MiniContext()
  ctx.plugin({
    name: 'tools',
    apply(c) {
      c.provide('tools', { list: () => ['echo'] })
    },
  })
  ctx.plugin({
    name: 'prompt',
    apply(c) {
      c.provide('prompt', { section: '- echo' })
    },
  })
  ctx.plugin({
    name: 'loop',
    apply(c) {
      c.provide('agentLoop', { run: () => 'v1 回答' })
    },
  })
  assert.deepEqual(ctx.get<{ list: () => string[] }>('tools').list(), ['echo'])
  assert.equal(ctx.get<{ run: () => string }>('agentLoop').run(), 'v1 回答')
})

test('卸载 loop 插件后服务消失，换新插件即换实现', () => {
  const ctx = new MiniContext()
  const unloadV1 = ctx.plugin({
    name: 'loop',
    apply(c) {
      c.provide('agentLoop', { run: () => 'v1' })
    },
  })
  unloadV1()
  assert.equal(ctx.has('agentLoop'), false)
  assert.throws(() => ctx.get('agentLoop'), /缺少服务/)

  ctx.plugin({
    name: 'loop',
    apply(c) {
      c.provide('agentLoop', { run: () => 'v2' })
    },
  })
  assert.equal(ctx.get<{ run: () => string }>('agentLoop').run(), 'v2')
})

test('同名插件二次加载抛错', () => {
  const ctx = new MiniContext()
  const def = { name: 'x', apply: () => {} }
  ctx.plugin(def)
  assert.throws(() => ctx.plugin(def), /插件已加载/)
})
