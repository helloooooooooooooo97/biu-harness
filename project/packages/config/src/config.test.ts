import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ConfigLoader, evalJs, expandIncludes, parseEntries, type PluginDef } from './index.ts'

// 本文件测 config：解析校验、js 表达式、include、装载。

test('evalJs 求值 js: 表达式', () => {
  assert.equal(evalJs('js: ctx.n + 1', { n: 41 }), 42)
  assert.equal(evalJs('plain', {}), 'plain')
})

test('parseEntries 支持 YAML 配置（含注释与布尔）', () => {
  const entries = parseEntries(`
# mini-dsh 插件树
entries:
  - id: t
    name: tools
  - id: t-echo
    name: tool-echo
    enabled: false
  - id: llm
    name: llm-mock
    config:
      model: deepseek-chat
`)
  assert.deepEqual(entries.map((e) => [e.id, e.name, e.enabled]), [
    ['t', 'tools', undefined],
    ['t-echo', 'tool-echo', false],
    ['llm', 'llm-mock', undefined],
  ])
  assert.equal((entries[2].config as Record<string, unknown>).model, 'deepseek-chat')
})

test('parseEntries 非法文本同时报 JSON/YAML 错误', () => {
  assert.throws(() => parseEntries('{{{{'), /配置解析失败/)
})

test('expandIncludes 展开 include 并求值 config', () => {
  const files = new Map([['base.json', '{"entries":[{"id":"t","name":"tools"}]}']])
  const entries = expandIncludes(
    parseEntries('{"entries":[{"id":"inc","name":"include","config":{"file":"base.json"}},{"id":"p","name":"prompt","config":{"prefix":"js: ctx.tag"}}]}'),
    files,
    { tag: 'dsh' },
  )
  assert.deepEqual(entries.map((e) => e.name), ['tools', 'prompt'])
  assert.equal((entries[1].config as Record<string, unknown>).prefix, 'dsh')
})

test('ConfigLoader 按配置装载并跳过 disabled', () => {
  const registry = new Map<string, PluginDef>([
    ['tools', { name: 'tools', apply(ctx) { ctx.provide('tools', 1) } }],
  ])
  const loader = new ConfigLoader({ registry })
  loader.load('{"entries":[{"id":"t","name":"tools"},{"id":"p","name":"prompt","enabled":false}]}')
  assert.equal(loader.plugins.pluginCount, 1)
  assert.ok(loader.plugins.has('tools'))
})
