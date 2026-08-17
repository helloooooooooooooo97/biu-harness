import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyError, isRetryable, retryClassified } from './index.ts'

// 本文件测 core-errors：分类、可重试判定、分类重试。

test('错误分类', () => {
  assert.equal(classifyError(new Error('HTTP 401')), 'auth')
  assert.equal(classifyError(new Error('HTTP 429')), 'rate-limit')
  assert.equal(classifyError(new Error('操作超时')), 'timeout')
  assert.equal(classifyError(new Error('HTTP 500')), 'server')
  assert.equal(isRetryable('rate-limit'), true)
  assert.equal(isRetryable('auth'), false)
})

test('分类重试：429 重试后成功，401 立即失败', async () => {
  let calls = 0
  const ok = await retryClassified(async () => {
    calls += 1
    if (calls < 2) throw new Error('HTTP 429')
    return 'ok'
  }, { attempts: 3 })
  assert.equal(ok, 'ok')

  let authCalls = 0
  await assert.rejects(() => retryClassified(async () => {
    authCalls += 1
    throw new Error('HTTP 401')
  }, { attempts: 3 }))
  assert.equal(authCalls, 1)
})
