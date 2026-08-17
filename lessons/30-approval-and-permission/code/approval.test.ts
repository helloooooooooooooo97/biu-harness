import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApprovalGate } from './approval.ts'

// 本文件测 ApprovalGate：① fail-closed；② resolver 允许/拒绝；③ 问题文本透传。

test('没有 resolver 时缺省拒绝（fail-closed）', async () => {
  // 验证安全默认：没人批准就不执行。
  const gate = new ApprovalGate()
  assert.equal(await gate.ask('允许？'), false)
})

test('resolver 决定允许或拒绝，且收到问题文本', async () => {
  const questions: string[] = []
  const gate = new ApprovalGate(async (q) => {
    questions.push(q)
    return q.includes('危险') ? false : true
  })
  assert.equal(await gate.ask('允许执行 危险？'), false)
  assert.equal(await gate.ask('允许执行 bash？'), true)
  assert.deepEqual(questions, ['允许执行 危险？', '允许执行 bash？'])
})
