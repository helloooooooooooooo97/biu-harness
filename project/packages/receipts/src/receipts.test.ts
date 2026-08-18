import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ReceiptStore, SteeringService, type InboxLike } from './index.ts'

// 本文件测回执：状态机与 steering 集成。

test('回执生命周期 accepted → claimed → discarded', () => {
  const store = new ReceiptStore()
  const id = store.accept('m1', 'next-step').messageId
  store.mark(id, 'claimed')
  assert.equal(store.get(id)?.status, 'claimed')
  store.mark(id, 'discarded')
  assert.equal(store.get(id)?.status, 'discarded')
})

test('SteeringService claim 后标记 claimed', () => {
  const queue: Array<{ id: string; content: string }> = []
  const inbox: InboxLike = {
    steer: (content) => { const m = { id: `m${queue.length + 1}`, content }; queue.push(m); return m },
    inject: (content) => { const m = { id: `m${queue.length + 1}`, content }; queue.push(m); return m },
    claimNextStep: () => queue.splice(0),
  }
  const service = new SteeringService(new ReceiptStore(), inbox)
  const id = service.steer('别用 bash')
  service.claimNextStep()
  assert.equal(service.receipt(id)?.status, 'claimed')
})
