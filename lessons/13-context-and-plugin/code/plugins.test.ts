import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMiniApp } from './app.ts'
import type { ToolsService, UiService } from './plugins.ts'

test('一切皆插件：四个插件组装出完整应用', () => {
  const ctx = createMiniApp()
  assert.equal(ctx.pluginCount, 4)
  assert.ok(ctx.has('sections'))
  assert.ok(ctx.has('tools'))
  assert.ok(ctx.has('ui'))
  const sections = ctx.get<string[]>('sections')
  assert.deepEqual(sections, ['- 可用工具：由 tools 插件注册'])
})

test('工具注册/执行/列表，卸载后移除', async () => {
  const ctx = createMiniApp()
  const tools = ctx.get<ToolsService>('tools')
  const off = tools.register('echo', async (args) => String(args.text ?? ''))
  assert.deepEqual(tools.list(), ['echo'])
  assert.equal(await tools.execute('echo', { text: 'hi' }), 'hi')
  off()
  assert.deepEqual(tools.list(), [])
})

test('UI 组件注册表：注册、列表、卸载', () => {
  const ctx = createMiniApp()
  const ui = ctx.get<UiService>('ui')
  const off = ui.registerComponent('clock', { render: 'Clock' })
  assert.deepEqual(ui.listComponents(), ['clock'])
  off()
  assert.deepEqual(ui.listComponents(), [])
})

test('卸载 prompt 插件后，它的提示词 section 被移除', () => {
  const ctx = createMiniApp()
  const sections = ctx.get<string[]>('sections')
  assert.equal(sections.length, 1)
  ctx.unload('prompt')
  assert.deepEqual(sections, [])
})

test('stop 后所有服务消失，再注册会被拒绝', () => {
  const ctx = createMiniApp()
  ctx.stop()
  assert.equal(ctx.has('tools'), false)
  assert.throws(() => ctx.effect(() => {}), /已停止/)
})
