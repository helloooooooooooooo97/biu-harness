import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PreStepBus, type PreStepPayload } from './pre-step.ts'

// 本文件测 PreStepBus：① 默认 enter；② 改写委托；③ 拒绝短路；④ 链式改写；⑤ disposer。

function payload(messages: Array<{ id: string; content: string }>): PreStepPayload {
  return { messages, turn: 1, step: 1 }
}

const msg = (id: string, content: string) => ({ id, content })

test('无监听器时默认 enter 原消息', () => {
  // 验证默认行为：没有拦截器时原样放行。
  const pre = new PreStepBus()
  const decision = pre.run(payload([msg('m1', '你好')]))
  assert.equal(decision.kind, 'enter')
  if (decision.kind === 'enter') {
    assert.deepEqual(decision.messages, [msg('m1', '你好')])
  }
})

test('监听器用 next 改写消息（委托）', () => {
  // 验证改写：next(新决策) 把改写后的消息传给下一个/最终结果。
  const pre = new PreStepBus()
  pre.on((decision, _payload, next) => {
    if (decision.kind === 'enter') {
      next({ kind: 'enter', messages: decision.messages.map((m) => ({ ...m, content: `[系统] ${m.content}` })) })
    }
  })
  const decision = pre.run(payload([msg('m1', '你好')]))
  assert.equal(decision.kind, 'enter')
  if (decision.kind === 'enter') {
    assert.equal(decision.messages[0].content, '[系统] 你好')
  }
})

test('监听器 return reject 短路，后面的不再执行', () => {
  // 验证拒绝语义：短路后第二个监听器不跑，决策是 reject。
  const pre = new PreStepBus()
  let secondRan = false
  pre.on((_decision, p, _next) => {
    if (p.messages.some((m) => m.content.includes('危险'))) {
      return { kind: 'reject' }
    }
  })
  pre.on(() => {
    secondRan = true
    return { kind: 'enter', messages: [] }
  })
  const decision = pre.run(payload([msg('m1', '危险命令')]))
  assert.equal(decision.kind, 'reject')
  assert.equal(secondRan, false)
})

test('多个监听器链式改写叠加', () => {
  // 验证瀑布链：每个监听器都委托，改写效果累积。
  const pre = new PreStepBus()
  pre.on((decision, _p, next) => {
    if (decision.kind === 'enter') {
      next({ kind: 'enter', messages: decision.messages.map((m) => ({ ...m, content: `${m.content}A` })) })
    }
  })
  pre.on((decision, _p, next) => {
    if (decision.kind === 'enter') {
      next({ kind: 'enter', messages: decision.messages.map((m) => ({ ...m, content: `${m.content}B` })) })
    }
  })
  const decision = pre.run(payload([msg('m1', 'x')]))
  if (decision.kind === 'enter') {
    assert.equal(decision.messages[0].content, 'xAB')
  }
})

test('disposer 移除监听器后失效', () => {
  // 验证可逆注册：卸载后拦截器不再生效。
  const pre = new PreStepBus()
  const off = pre.on((decision, _p, next) => {
    if (decision.kind === 'enter') {
      next({ kind: 'enter', messages: [] })
    }
  })
  off()
  const decision = pre.run(payload([msg('m1', '你好')]))
  assert.equal(decision.kind, 'enter')
  if (decision.kind === 'enter') {
    assert.deepEqual(decision.messages, [msg('m1', '你好')])
  }
})
