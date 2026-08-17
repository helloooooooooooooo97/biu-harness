import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventBus } from './events.ts'

// 本文件测 EventBus 四模式：① emit 顺序；② off/prepend；③ waterfall 委托；④ waterfall 短路；⑤ parallel；⑥ serial；⑦ 空监听器。

test('emit：按注册顺序通知，忽略返回值', () => {
  // 验证 emit 语义：同步、按注册顺序、监听器返回值被忽略（不传给下一个）。
  const bus = new EventBus()
  const order: string[] = []
  bus.on('x', () => {
    order.push('a')
    return 'ignored'
  })
  bus.on('x', () => {
    order.push('b')
  })
  bus.emit('x')
  assert.deepEqual(order, ['a', 'b'])
})

test('off 移除监听器，prepend 让监听器排到队首', () => {
  // 验证 on 的选项与卸载：prepend 插队首，off 移除后不再触发。
  const bus = new EventBus()
  const order: string[] = []
  const off = bus.on('x', () => order.push('a'))
  bus.on('x', () => order.push('b'), { prepend: true })
  bus.emit('x')
  assert.deepEqual(order, ['b', 'a'])
  off()
  bus.emit('x')
  assert.deepEqual(order, ['b', 'a', 'b'])
  assert.equal(bus.listenerCount('x'), 1)
})

test('waterfall：next 委托链式传值', () => {
  // 验证 waterfall 委托：每个监听器用 next(新值) 传递，最终结果是链式拼接后的值。
  const bus = new EventBus()
  bus.on('prompt', (value: unknown, _ctx: unknown, next: (v: unknown) => void) => {
    next(`${String(value)} + sectionA`)
  })
  bus.on('prompt', (value: unknown, _ctx: unknown, next: (v: unknown) => void) => {
    next(`${String(value)} + sectionB`)
  })
  const result = bus.waterfall('prompt', 'base', {})
  assert.equal(result, 'base + sectionA + sectionB')
})

test('waterfall：不调用 next 直接 return 则短路', () => {
  // 验证短路语义：监听器不调 next 直接 return 时，后面的监听器不执行，返回值就是最终结果（权限决策场景）。
  const bus = new EventBus()
  let bRan = false
  bus.on('ask', (_value: unknown, _ctx: unknown, next: (v: unknown) => void) => {
    return '拒绝' // 拥有决策权，不委托
  })
  bus.on('ask', () => {
    bRan = true
    return '允许'
  })
  const result = bus.waterfall('ask', '待定', {})
  assert.equal(result, '拒绝')
  assert.equal(bRan, false)
})

test('parallel：并行执行并等待，返回结果数组', async () => {
  // 验证 parallel：全部监听器并行执行，Promise.all 等待完成后按注册顺序返回结果数组。
  const bus = new EventBus()
  bus.on('job', async (n: unknown) => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return `a${String(n)}`
  })
  bus.on('job', async (n: unknown) => `b${String(n)}`)
  const results = await bus.parallel('job', 1)
  assert.deepEqual(results, ['a1', 'b1'])
})

test('serial：按序 await，返回最后一个结果', async () => {
  // 验证 serial：监听器严格按注册顺序依次 await（a 先于 b），返回最后一个的结果。
  const bus = new EventBus()
  const order: string[] = []
  bus.on('task', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
    order.push('a')
    return 'first'
  })
  bus.on('task', async () => {
    order.push('b')
    return 'second'
  })
  const result = await bus.serial('task')
  assert.deepEqual(order, ['a', 'b'])
  assert.equal(result, 'second')
})

test('没有监听器时四种模式都不抛错', async () => {
  // 验证空事件的安全兜底：四种模式在无监听器时都能正常返回（emit 无操作、waterfall 返回初始值等）。
  const bus = new EventBus()
  bus.emit('none')
  assert.equal(bus.waterfall('none', 'initial'), 'initial')
  assert.deepEqual(await bus.parallel('none'), [])
  assert.equal(await bus.serial('none'), undefined)
})
