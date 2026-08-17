import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ConfigLoader } from './loader.ts'
import { ConfigWatcher } from './config-watcher.ts'
import { BUILTIN_PLUGINS } from './plugins.ts'

// 本文件测 ConfigWatcher：① 变更通知；② 坏配置走 onError 且旧树保留。

test('push 成功后触发 onChange', () => {
  // 验证热重载入口：配置变更 → 树更新 → 回调被调用。
  const loader = new ConfigLoader({ registry: BUILTIN_PLUGINS })
  const watcher = new ConfigWatcher(loader)
  let changed = 0
  watcher.subscribe(() => {
    changed += 1
  })
  watcher.push('{"entries":[{"id":"t","name":"tools"}]}')
  assert.equal(changed, 1)
  assert.ok(loader.plugins.has('tools'))
})

test('坏配置触发 onError 且上一个稳定树保留', () => {
  // 验证失败路径：坏配置 → onError 被调用，旧树（tools）仍然可用。
  const loader = new ConfigLoader({ registry: BUILTIN_PLUGINS })
  const watcher = new ConfigWatcher(loader)
  loader.applyConfig('{"entries":[{"id":"t","name":"tools"}]}')
  let error: unknown = null
  watcher.subscribe(() => {}, (err) => {
    error = err
  })
  watcher.push('{"entries":[{"id":"g","name":"ghost"}]}')
  assert.ok(error instanceof Error)
  assert.match((error as Error).message, /未知插件: ghost/)
  assert.ok(loader.plugins.has('tools'))
})
