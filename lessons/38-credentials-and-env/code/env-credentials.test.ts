import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLayeredEnv, parseEnv } from './env.ts'
import { CredentialsStore, redactSecrets } from './credentials.ts'

// 本文件测环境分层与凭据：① 解析；② 优先级；③ 凭据；④ 脱敏。

test('parseEnv 解析 KEY=VALUE 并忽略注释', () => {
  assert.deepEqual(parseEnv('# 注释\nKEY=a\nOTHER = b'), { KEY: 'a', OTHER: 'b' })
})

test('loadLayeredEnv：后者覆盖前者，inherited 最高', () => {
  const env = loadLayeredEnv(['KEY=a\nONLY=user', 'KEY=b'], { KEY: 'c' })
  assert.equal(env.KEY, 'c')
  assert.equal(env.ONLY, 'user')
})

test('CredentialsStore 读写删', () => {
  const store = new CredentialsStore()
  store.set('deepseek', 'sk-123')
  assert.equal(store.get('deepseek'), 'sk-123')
  assert.ok(store.has('deepseek'))
  store.remove('deepseek')
  assert.equal(store.has('deepseek'), false)
})

test('redactSecrets 打码密钥', () => {
  assert.equal(redactSecrets('Bearer sk-123 失败', ['sk-123']), 'Bearer *** 失败')
  assert.equal(redactSecrets('普通文本', ['sk-999']), '普通文本')
})
