import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ToolPipeline, type ToolInvocation } from './pipeline.ts'

// 本文件测 core-tools 的执行流水线：拒绝/审批/抛错/result 通知。

const inv = (name = 'x'): ToolInvocation => ({ callId: 'c1', name, arguments: {} })

test('guard 拒绝后 body 不执行', async () => {
  const pipeline = new ToolPipeline()
  let ran = false
  pipeline.addGuard(() => ({ allow: false, reason: '拒绝' }))
  const result = await pipeline.execute(inv(), async () => {
    ran = true
    return 'ok'
  })
  assert.equal(ran, false)
  assert.equal(result.denied, true)
})

test('审批拒绝与通过', async () => {
  const pipeline = new ToolPipeline()
  pipeline.setApproval({ ask: async () => false })
  assert.equal((await pipeline.execute(inv(), async () => 'x')).denied, true)
  pipeline.setApproval({ ask: async () => true })
  assert.equal((await pipeline.execute(inv(), async () => 'x')).isError, false)
})

test('result 通知收到冻结结果', async () => {
  const pipeline = new ToolPipeline()
  const seen: string[] = []
  pipeline.onResult((r) => seen.push(r.text))
  await pipeline.execute(inv(), async () => '值')
  assert.equal(seen.length, 1)
})
