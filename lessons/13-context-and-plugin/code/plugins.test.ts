import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMiniApp } from './app.ts'
import type { ToolsService, UiService } from './plugins.ts'

// 本文件测"一切皆插件"组装：① 四插件组装；② 工具服务；③ UI 服务；④ 卸载 prompt；⑤ stop 后拒绝注册。

test('一切皆插件：四个插件组装出完整应用', () => {
  // 验证 sections/tools/prompt/ui 四个插件加载后，服务齐备且提示词 section 已注册。
  const ctx = createMiniApp()
  assert.equal(ctx.pluginCount, 4)
  assert.ok(ctx.has('sections'))
  assert.ok(ctx.has('tools'))
  assert.ok(ctx.has('ui'))
  const sections = ctx.get<string[]>('sections')
  assert.deepEqual(sections, ['- 可用工具：由 tools 插件注册'])
})

test('工具注册/执行/列表，卸载后移除', async () => {
  // 验证工具服务：register 后 list/execute 可用，disposer 调用后从列表移除。
  const ctx = createMiniApp()
  const tools = ctx.get<ToolsService>('tools')
  const off = tools.register('echo', async (args) => String(args.text ?? ''))
  assert.deepEqual(tools.list(), ['echo'])
  assert.equal(await tools.execute('echo', { text: 'hi' }), 'hi')
  off()
  assert.deepEqual(tools.list(), [])
})

test('UI 组件注册表：注册、列表、卸载', () => {
  // 验证 UI 服务：组件可注册/列出/卸载（同样遵循"注册即可逆"）。
  const ctx = createMiniApp()
  const ui = ctx.get<UiService>('ui')
  const off = ui.registerComponent('clock', { render: 'Clock' })
  assert.deepEqual(ui.listComponents(), ['clock'])
  off()
  assert.deepEqual(ui.listComponents(), [])
})

test('卸载 prompt 插件后，它的提示词 section 被移除', () => {
  // 验证插件贡献可逆：unload('prompt') 后 sections 里它的提示词被清理干净。
  const ctx = createMiniApp()
  const sections = ctx.get<string[]>('sections')
  assert.equal(sections.length, 1)
  ctx.unload('prompt')
  assert.deepEqual(sections, [])
})

test('stop 后所有服务消失，再注册会被拒绝', () => {
  // 验证停机后状态：服务清空，且再调 effect() 抛"已停止"（防止停机后继续注册）。
  const ctx = createMiniApp()
  ctx.stop()
  assert.equal(ctx.has('tools'), false)
  assert.throws(() => ctx.effect(() => {}), /已停止/)
})
