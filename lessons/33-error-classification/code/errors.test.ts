import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyError, isRetryable, retryableReason, type ErrorCategory } from './errors.ts'
import { retryClassified } from './retry.ts'

// 本文件测错误分类：① 分类矩阵；② 可重试判定；③ retryClassified 策略。

test('分类矩阵', () => {
  const cases: Array<[string, ErrorCategory]> = [
    ['HTTP 401: bad key', 'auth'],
    ['HTTP 403: forbidden', 'auth'],
    ['HTTP 429: rate limit', 'rate-limit'],
    ['操作超时（1000ms）', 'timeout'],
    ['fetch failed', 'network'],
    ['HTTP 400: bad request', 'bad-request'],
    ['HTTP 500: internal', 'server'],
    ['奇怪的东西', 'unknown'],
  ]
  for (const [message, expected] of cases) {
    assert.equal(classifyError(new Error(message)), expected, message)
  }
})

test('可重试判定：rate-limit/timeout/network/server 为真，其余为假', () => {
  assert.equal(isRetryable('rate-limit'), true)
  assert.equal(isRetryable('timeout'), true)
  assert.equal(isRetryable('network'), true)
  assert.equal(isRetryable('server'), true)
  assert.equal(isRetryable('auth'), false)
  assert.equal(isRetryable('bad-request'), false)
  assert.equal(isRetryable('unknown'), false)
})

test('retryClassified 对 429 重试后成功', async () => {
  let calls = 0
  const result = await retryClassified(async () => {
    calls += 1
    if (calls < 3) throw new Error('HTTP 429: slow down')
    return '成功'
  }, { attempts: 3 })
  assert.equal(calls, 3)
  assert.equal(result, '成功')
})

test('retryClassified 对 401 只调用一次就抛错', async () => {
  let calls = 0
  await assert.rejects(
    () => retryClassified(async () => {
      calls += 1
      throw new Error('HTTP 401: invalid key')
    }, { attempts: 3 }),
    /HTTP 401/,
  )
  assert.equal(calls, 1)
})

test('retryableReason 输出人类可读判定', () => {
  assert.equal(retryableReason(new Error('HTTP 429')), '可重试（rate-limit）')
  assert.equal(retryableReason(new Error('HTTP 401')), '不可重试（auth）')
})
