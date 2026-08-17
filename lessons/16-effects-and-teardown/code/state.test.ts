import { test } from 'node:test'
import assert from 'node:assert/strict'
import { StateStore } from './state.ts'

// 本文件测 StateStore：① set/get；② snapshot/restore 无损往返。

test('set/get 基础读写', () => {
  // 验证状态存取与类型化读取。
  const store = new StateStore()
  store.set('count', 3)
  assert.equal(store.get<number>('count'), 3)
  assert.equal(store.size, 1)
})

test('snapshot/restore 无损往返', () => {
  // 验证重载前快照、失败后恢复的机制：序列化再还原，内容一致。
  const store = new StateStore()
  store.set('count', 3)
  store.set('label', 'hi')
  const snapshot = store.snapshot()
  store.set('count', 99)
  store.restore(snapshot)
  assert.equal(store.get<number>('count'), 3)
  assert.equal(store.get<string>('label'), 'hi')
})
