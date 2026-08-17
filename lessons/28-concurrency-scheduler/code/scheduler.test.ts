import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Barrier, mapLimit, runSerial } from './scheduler.ts'

// 本文件测调度器：① 并发上限；② 结果按输入顺序；③ 串行保序；④ Barrier。

test('mapLimit 限制最大并发且结果按输入顺序', async () => {
  // 验证 rolling pool：同时活跃数不超过 limit，结果数组顺序与输入一致。
  let active = 0
  let maxActive = 0
  const results = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active -= 1
    return n * 10
  })
  assert.equal(maxActive, 2)
  assert.deepEqual(results, [10, 20, 30, 40, 50])
})

test('limit 大于等于数量时全部并行', async () => {
  let active = 0
  let maxActive = 0
  await mapLimit([1, 2, 3], 10, async () => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => setTimeout(resolve, 3))
    active -= 1
  })
  assert.equal(maxActive, 3)
})

test('runSerial 严格保序', async () => {
  // 验证串行：完成顺序 = 输入顺序（后一个必须等前一个）。
  const order: number[] = []
  await runSerial([1, 2, 3], async (n) => {
    await new Promise((resolve) => setTimeout(resolve, n === 1 ? 10 : 1))
    order.push(n)
  })
  assert.deepEqual(order, [1, 2, 3])
})

test('Barrier 等全部 arrive 后放行', async () => {
  const barrier = new Barrier(3)
  let released = false
  const waiting = barrier.wait().then(() => {
    released = true
  })
  barrier.arrive()
  barrier.arrive()
  assert.equal(released, false)
  barrier.arrive()
  await waiting
  assert.equal(released, true)
  assert.equal(barrier.remaining, 0)
})

test('Barrier 已归零时 wait 立即 resolve', async () => {
  const barrier = new Barrier(1)
  barrier.arrive()
  await assert.doesNotReject(barrier.wait())
})
