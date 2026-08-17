import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Barrier, mapLimit, runSerial } from './index.ts'

// 本文件测 core-scheduler：并发上限、串行保序、Barrier。

test('mapLimit 限制并发且按输入顺序返回', async () => {
  let active = 0
  let maxActive = 0
  const results = await mapLimit([1, 2, 3, 4], 2, async (n) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => setTimeout(resolve, 3))
    active -= 1
    return n * 2
  })
  assert.equal(maxActive, 2)
  assert.deepEqual(results, [2, 4, 6, 8])
})

test('runSerial 严格保序', async () => {
  const order: number[] = []
  await runSerial([1, 2, 3], async (n) => {
    await new Promise((resolve) => setTimeout(resolve, n === 1 ? 10 : 1))
    order.push(n)
  })
  assert.deepEqual(order, [1, 2, 3])
})

test('Barrier 等全部 arrive 后放行', async () => {
  const barrier = new Barrier(2)
  let released = false
  const waiting = barrier.wait().then(() => {
    released = true
  })
  barrier.arrive()
  assert.equal(released, false)
  barrier.arrive()
  await waiting
  assert.equal(released, true)
})
