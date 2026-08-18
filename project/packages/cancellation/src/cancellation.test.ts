import { test } from 'node:test'
import assert from 'node:assert/strict'
import { abortable, Cancellation, ProcessTracker } from './index.ts'

// 本文件测取消：令牌、abortable、进程树。

test('cancel 设置 cause 并 abort', () => {
  const cancel = new Cancellation()
  cancel.cancel({ kind: 'user' })
  assert.equal(cancel.signal.aborted, true)
  assert.deepEqual(cancel.cause, { kind: 'user' })
})

test('abortable 在取消时以 AbortError 拒绝', async () => {
  const cancel = new Cancellation()
  const work = abortable(new Promise<string>(() => {}), cancel.signal)
  cancel.cancel({ kind: 'user' })
  await assert.rejects(() => work, (err: unknown) => (err as Error).name === 'AbortError')
})

test('ProcessTracker 整组 kill', () => {
  const tracker = new ProcessTracker()
  const killed: string[] = []
  tracker.track({ pid: 1, kill: (s) => { killed.push(s ?? ''); return true } })
  assert.equal(tracker.killAll('SIGTERM'), 1)
  assert.deepEqual(killed, ['SIGTERM'])
})
