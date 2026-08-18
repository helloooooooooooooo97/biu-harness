import { test } from 'node:test'
import assert from 'node:assert/strict'
import { abortable, Cancellation } from './cancel.ts'
import { ProcessTracker, type TrackedProcess } from './processes.ts'

// 本文件测取消：① 令牌；② abortable；③ 进程树。

test('cancel 设置 cause 并 abort signal，二次取消无效', () => {
  const cancel = new Cancellation()
  cancel.cancel({ kind: 'user' })
  assert.equal(cancel.signal.aborted, true)
  assert.deepEqual(cancel.cause, { kind: 'user' })
  cancel.cancel({ kind: 'disposed' })
  assert.deepEqual(cancel.cause, { kind: 'user' })   // 第一次生效
})

test('abortable 在取消时以 AbortError 拒绝', async () => {
  const cancel = new Cancellation()
  const pending = new Promise<string>(() => {})
  const work = abortable(pending, cancel.signal)
  cancel.cancel({ kind: 'user' })
  await assert.rejects(() => work, (err: unknown) => (err as Error).name === 'AbortError')
})

test('ProcessTracker 记录并整组 kill', () => {
  const tracker = new ProcessTracker()
  const killed: string[] = []
  const fake: TrackedProcess = {
    pid: 42,
    kill: (signal) => {
      killed.push(signal ?? '')
      return true
    },
  }
  tracker.track(fake)
  assert.equal(tracker.size, 1)
  assert.equal(tracker.killAll('SIGTERM'), 1)
  assert.deepEqual(killed, ['SIGTERM'])
  assert.equal(tracker.size, 0)
})

test('abortable 对已中止的 signal 立即拒绝', async () => {
  const cancel = new Cancellation()
  cancel.cancel({ kind: 'hook', reason: '超时' })
  await assert.rejects(
    () => abortable(Promise.resolve('x'), cancel.signal),
    (err: unknown) => (err as Error).name === 'AbortError',
  )
})
