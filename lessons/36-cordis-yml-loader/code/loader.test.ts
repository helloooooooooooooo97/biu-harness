import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PluginDef } from './host.ts'
import { ConfigLoader } from './loader.ts'

// 本文件测 ConfigLoader：① 装载；② disabled 跳过；③ include 后装载；④ 未知插件。

const registry = new Map<string, PluginDef>([
  ['tools', { name: 'tools', apply(ctx) { ctx.provide('tools', { list: () => ['echo'] }) } }],
  ['prompt', { name: 'prompt', apply(ctx) { ctx.provide('prompt', { section: '- echo' }) } }],
])

test('按配置装载插件树并跳过 disabled', () => {
  const loader = new ConfigLoader({ registry })
  loader.load('{"entries":[{"id":"t","name":"tools"},{"id":"p","name":"prompt","enabled":false}]}')
  assert.equal(loader.plugins.pluginCount, 1)
  assert.ok(loader.plugins.has('tools'))
  assert.ok(!loader.plugins.has('prompt'))
})

test('include 展开后装载', () => {
  const loader = new ConfigLoader({
    registry,
    files: new Map([['base.json', '{"entries":[{"id":"t","name":"tools"}]}']]),
  })
  loader.load('{"entries":[{"id":"inc","name":"include","config":{"file":"base.json"}}]}')
  assert.ok(loader.plugins.has('tools'))
})

test('未知插件抛错', () => {
  const loader = new ConfigLoader({ registry })
  assert.throws(() => loader.load('{"entries":[{"id":"g","name":"ghost"}]}'), /未知插件: ghost/)
})
