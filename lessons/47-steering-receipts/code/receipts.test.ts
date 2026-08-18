import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ReceiptStore } from './receipts.ts'
import { SteeringService, type InboxLike } from './steering.ts'

// 本文件测回执：① 状态机；② 查询；③ steering 集成。

test('回执生命周期 accepted → claimed → discarded', () => {
  const store = new ReceiptStore()
  const id = store.accept('m1', 'next-step').messageId
  assert.equal(store.get(id)?.status, 'accepted')
  store.mark(id, 'claimed')
  assert.equal(store.get(id)?.status, 'claimed')
  store.mark(id, 'discarded')
  assert.equal(store.get(id)?.status, 'discarded')
})

test('未知 messageId 返回 undefined，mark 未知抛错', () => {
  const store = new ReceiptStore()
  assert.equal(store.get('nope'), undefined)
  assert.throws(() => store.mark('nope', 'claimed'), /未知回执/)
})

test('steer 返回回执，claim 后标记 claimed', () => {
  const queue: Array<{ id: string; content: string }> = []
  const inbox: InboxLike = {
    steer: (content) => {
      const message = { id: `m${queue.length + 1}`, content }
      queue.push(message)
      return message
    },
    inject: (content) => {
      const message = { id: `m${queue.length + 1}`, content }
      queue.push(message)
      return message
    },
    claimNextStep: () => queue.splice(0),
  }
  const store = new ReceiptStore()
  const service = new SteeringService(store, inbox)

  const id = service.steer('别用 bash')
  assert.equal(service.receipt(id)?.status, 'accepted')
  service.claimNextStep()
  assert.equal(service.receipt(id)?.status, 'claimed')
})
