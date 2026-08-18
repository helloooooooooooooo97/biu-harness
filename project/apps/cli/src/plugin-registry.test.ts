import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listPluginFiles, loadAllPlugins, loadPluginModule } from './plugin-registry.ts'

// 本文件测插件目录加载器：目录扫描 = 注册表，install(name) 的底层就是 import()。

test('loadAllPlugins 扫描 plugins/ 目录得到完整注册表', async () => {
  const all = await loadAllPlugins()
  for (const name of ['session', 'telemetry', 'tools', 'tool-echo', 'prompt-identity', 'agent-loop', 'headless', 'rpc']) {
    assert.ok(all.has(name), `缺少插件 ${name}`)
  }
  // 注册类插件分组在 registry/ 下，也应被递归扫描到
  for (const name of ['tools', 'skills', 'presets', 'subagents', 'prompt']) {
    assert.ok(all.has(name), `缺少注册类插件 ${name}`)
  }
  // web 表面 bundle（frontend-static / web-runtime / client-hmr）
  for (const name of ['frontend-static', 'web-runtime', 'client-hmr']) {
    assert.ok(all.has(name), `缺少 web 插件 ${name}`)
  }
  assert.equal(all.size, 27)
})

test('loadPluginModule 按目录 import() 单个插件模块', async () => {
  const def = await loadPluginModule('agent-loop-v2')
  assert.equal(def.name, 'agent-loop-v2')
  assert.equal(def.provide, 'agentLoop')
})

test('分组目录里的注册类插件也能按名加载', async () => {
  const def = await loadPluginModule('tools')
  assert.equal(def.name, 'tools')
  assert.equal(def.provide, 'tools')
})

test('listPluginFiles 返回插件目录 mtime 快照（供 watchPlugins 轮询）', () => {
  const files = listPluginFiles()
  assert.ok(files.some((f) => f.name === 'tools'))
  assert.ok(files.some((f) => f.name === 'skills'))
  assert.ok(files.every((f) => typeof f.mtimeMs === 'number'))
})

test('未知插件目录抛错', async () => {
  await assert.rejects(() => loadPluginModule('ghost-plugin'), /插件文件不存在/)
})
