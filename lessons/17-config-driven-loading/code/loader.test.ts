import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ConfigLoader } from './loader.ts'
import { BUILTIN_PLUGINS } from './plugins.ts'

// 本文件测 ConfigLoader：① 按配置装载；② disabled 跳过；③ 热重载切换；④ 坏配置回滚。

const loader = () => new ConfigLoader({ registry: BUILTIN_PLUGINS })

test('按配置装载插件树并跳过 disabled', () => {
  // 验证 enabled 语义：tools/prompt 加载，logger 跳过。
  const l = loader()
  l.applyConfig('{"entries":[{"id":"t","name":"tools"},{"id":"p","name":"prompt"},{"id":"lg","name":"logger","enabled":false}]}')
  assert.equal(l.plugins.pluginCount, 2)
  assert.ok(l.plugins.has('tools'))
  assert.ok(l.plugins.has('prompt'))
  assert.ok(!l.plugins.has('logger'))
})

test('热重载切换插件树', () => {
  // 验证整树替换：配置 A（tools）→ 配置 B（logger），旧服务消失、新服务出现。
  const l = loader()
  l.applyConfig('{"entries":[{"id":"t","name":"tools"}]}')
  assert.ok(l.plugins.has('tools'))
  l.applyConfig('{"entries":[{"id":"lg","name":"logger"}]}')
  assert.ok(!l.plugins.has('tools'))
  assert.ok(l.plugins.has('logger'))
})

test('未知插件抛错并回滚到上一个稳定树', () => {
  // 验证失败要响亮 + 不破坏现状：ghost 未注册 → 抛错，旧树（tools）仍在。
  const l = loader()
  l.applyConfig('{"entries":[{"id":"t","name":"tools"}]}')
  assert.throws(
    () => l.applyConfig('{"entries":[{"id":"g","name":"ghost"}]}'),
    /未知插件: ghost/,
  )
  assert.equal(l.plugins.pluginCount, 1)
  assert.ok(l.plugins.has('tools'))
})

test('apply 失败的插件触发整树回滚', () => {
  // 验证运行期失败也回滚：registry 里有一个 apply 抛错的插件。
  const registry = new Map(BUILTIN_PLUGINS)
  registry.set('bad', { name: 'bad', apply() { throw new Error('boom') } })
  const l = new ConfigLoader({ registry })
  l.applyConfig('{"entries":[{"id":"t","name":"tools"}]}')
  assert.throws(
    () => l.applyConfig('{"entries":[{"id":"b","name":"bad"}]}'),
    /boom/,
  )
  assert.ok(l.plugins.has('tools'))
  assert.equal(l.plugins.pluginCount, 1)
})
