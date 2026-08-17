import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ToolPipeline, type ApprovalLike, type ToolInvocation } from './pipeline.ts'

// 本文件测 ToolPipeline：① pre 拒绝；② guard 单调；③ 审批；④ 抛错；⑤ post 改写；⑥ finalize；⑦ result 通知。

const inv = (name = 'x'): ToolInvocation => ({ callId: 'c1', name, arguments: {} })

test('pre 拒绝：body 不执行，结果 denied', async () => {
  const pipeline = new ToolPipeline()
  let bodyRan = false
  pipeline.onPre(() => ({ allow: false, reason: '禁止' }))
  const result = await pipeline.execute(inv(), async () => {
    bodyRan = true
    return 'ok'
  })
  assert.equal(bodyRan, false)
  assert.equal(result.denied, true)
  assert.equal(result.text, '禁止')
})

test('guard 单调：拒绝后后续 guard 无法撤销', async () => {
  const pipeline = new ToolPipeline()
  pipeline.addGuard(() => ({ allow: false, reason: '安全策略拒绝' }))
  pipeline.addGuard(() => ({ allow: true })) // 后来的"允许"不能撤销
  const result = await pipeline.execute(inv(), async () => 'ok')
  assert.equal(result.denied, true)
  assert.match(result.text, /安全策略拒绝/)
})

test('审批拒绝/通过', async () => {
  const pipeline = new ToolPipeline()
  const approval: ApprovalLike = { ask: async (q) => q.includes('危险') ? false : true }
  pipeline.setApproval(approval)
  const denied = await pipeline.execute({ callId: 'c1', name: '危险', arguments: {} }, async () => 'ok')
  assert.equal(denied.denied, true)
  const allowed = await pipeline.execute({ callId: 'c2', name: '安全', arguments: {} }, async () => 'ok')
  assert.equal(allowed.isError, false)
  assert.equal(allowed.value, 'ok')
})

test('body 抛错：isError 且文本含错误', async () => {
  const pipeline = new ToolPipeline()
  const result = await pipeline.execute(inv(), async () => {
    throw new Error('执行失败')
  })
  assert.equal(result.isError, true)
  assert.match(result.text, /执行失败/)
})

test('post 改写结果文本', async () => {
  const pipeline = new ToolPipeline()
  pipeline.onPost((text, _i, next) => next(`${text}（已处理）`))
  const result = await pipeline.execute(inv(), async () => '值')
  assert.match(result.text, /"值"（已处理）/)
})

test('finalize 抛错变为 isError', async () => {
  const pipeline = new ToolPipeline()
  const result = await pipeline.execute(inv(), async () => '内容', {
    finalizeContent: () => {
      throw new Error('内容非法')
    },
  })
  assert.equal(result.isError, true)
  assert.match(result.text, /内容非法/)
})

test('tools/result 收到冻结结果', async () => {
  const pipeline = new ToolPipeline()
  const seen: Array<{ text: string }> = []
  pipeline.onResult((result) => seen.push(result))
  await pipeline.execute(inv(), async () => '值')
  assert.equal(seen.length, 1)
  assert.match(seen[0].text, /"值"/)
})
