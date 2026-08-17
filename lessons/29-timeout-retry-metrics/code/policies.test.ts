import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Metrics, retry, withTimeout } from './policies.ts'

// 本文件测 policies：① 超时拒绝；② 超时不触发则通过；③ 重试成功；④ 重试耗尽；⑤ 分类不重试；⑥ 指标。

test('withTimeout 超时拒绝', async () => {
  // 验证期限：慢 promise 超过 ms 后被拒绝，错误信息含"超时"。
  const slow = new Promise<string>((resolve) => setTimeout(() => resolve('太慢'), 100))
  await assert.rejects(() => withTimeout(slow, 10), /超时/)
})

test('withTimeout 快 promise 正常通过', async () => {
  const fast = Promise.resolve('快')
  assert.equal(await withTimeout(fast, 50), '快')
})

test('retry 前两次失败第三次成功', async () => {
  // 验证有限重试：attempts=3 时，前 2 次抛错、第 3 次成功。
  let calls = 0
  const result = await retry(async () => {
    calls += 1
    if (calls < 3) throw new Error(`失败 ${calls}`)
    return '成功'
  }, { attempts: 3 })
  assert.equal(calls, 3)
  assert.equal(result, '成功')
})

test('retry 耗尽后抛出最后一次错误', async () => {
  await assert.rejects(
    () => retry(async () => {
      throw new Error('一直失败')
    }, { attempts: 2 }),
    /一直失败/,
  )
})

test('shouldRetry 返回 false 时立即抛错不再尝试', async () => {
  // 验证分类：不可重试错误（如参数错误）直接抛出。
  let calls = 0
  await assert.rejects(
    () => retry(async () => {
      calls += 1
      throw new Error('HTTP 400')
    }, { attempts: 3, shouldRetry: (err) => !err.message.includes('400') }),
    /HTTP 400/,
  )
  assert.equal(calls, 1)
})

test('Metrics 计数/求和/快照', () => {
  const metrics = new Metrics()
  metrics.inc('attempts')
  metrics.inc('attempts')
  metrics.add('duration_ms', 120)
  assert.equal(metrics.get('attempts'), 2)
  assert.equal(metrics.get('duration_ms'), 120)
  assert.deepEqual(metrics.snapshot(), { attempts: 2, duration_ms: 120 })
})
