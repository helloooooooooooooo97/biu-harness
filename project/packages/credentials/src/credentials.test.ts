import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CredentialsStore, loadLayeredEnv, redactSecrets } from './index.ts'

// 本文件测凭据与环境：分层优先级、凭据、脱敏。

test('loadLayeredEnv 后者覆盖前者，inherited 最高', () => {
  const env = loadLayeredEnv(['KEY=a\nONLY=user', 'KEY=b'], { KEY: 'c' })
  assert.equal(env.KEY, 'c')
  assert.equal(env.ONLY, 'user')
})

test('CredentialsStore 读写', () => {
  const store = new CredentialsStore()
  store.set('deepseek', 'sk-1')
  assert.equal(store.get('deepseek'), 'sk-1')
})

test('redactSecrets 打码', () => {
  assert.equal(redactSecrets('Bearer sk-1', ['sk-1']), 'Bearer ***')
})
