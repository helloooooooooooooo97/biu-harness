import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Inbox } from './inbox.ts'

// 本文件测 Inbox：① 三种投递的队列归属；② turn claim；③ step claim；④ id 唯一。

test('followup 进 next-turn，steer/inject 进 next-step', () => {
  // 验证队列归属：普通追问与插队消息各就各位。
  const inbox = new Inbox()
  inbox.followup('a')
  inbox.steer('b')
  inbox.inject('c')
  const turnClaim = inbox.claimNextTurn()
  assert.equal(turnClaim.turnInput?.content, 'a')
  assert.deepEqual(
    turnClaim.stepInputs.map((m) => m.content),
    ['b', 'c'],
  )
  assert.ok(inbox.isEmpty)
})

test('step claim 只拿 next-step，不影响 next-turn', () => {
  // 验证工具续轮语义：插队消息被取走，普通追问还留着。
  const inbox = new Inbox()
  inbox.followup('q')
  inbox.inject('x')
  const stepInputs = inbox.claimNextStep()
  assert.deepEqual(stepInputs.map((m) => m.content), ['x'])
  assert.ok(!inbox.isEmpty, 'next-turn 里还有 followup')
  assert.equal(inbox.claimNextTurn().turnInput?.content, 'q')
})

test('消息 id 唯一且递增', () => {
  // 验证身份：每条输入有稳定 id（重放/回执都靠它）。
  const inbox = new Inbox()
  const a = inbox.followup('a')
  const b = inbox.steer('b')
  const c = inbox.inject('c')
  assert.equal(a.id, 'm1')
  assert.equal(b.id, 'm2')
  assert.equal(c.id, 'm3')
})
