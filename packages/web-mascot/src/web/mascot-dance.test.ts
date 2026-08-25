import { afterEach, test, vi } from 'vitest'
import assert from 'node:assert/strict'
import {
  isMascotDancing,
  remainingMascotDanceMs,
  startMascotDance,
  stopMascotDance,
  subscribeMascotDance,
} from './mascot-dance.ts'

afterEach(() => {
  vi.useRealTimers()
})

// 同时 fake setTimeout 与 Date.now，让 dance 窗口随假时钟推进而真正过期
const useFakeClock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })

test('startMascotDance marks dancing until duration elapses', () => {
  useFakeClock()
  startMascotDance(1600)
  assert.ok(isMascotDancing())
  assert.ok(remainingMascotDanceMs() > 0)
  vi.advanceTimersByTime(2000)
  assert.equal(isMascotDancing(), false)
  assert.equal(remainingMascotDanceMs(), 0)
})

test('subscribe notifies on dance start and end', () => {
  useFakeClock()
  const ticks: boolean[] = []
  const unsub = subscribeMascotDance(() => ticks.push(isMascotDancing()))
  startMascotDance(1600)
  vi.advanceTimersByTime(2000)
  unsub()
  // 开始(→true) 与结束(→false) 都应触发通知
  assert.ok(ticks.includes(true))
  assert.ok(ticks.includes(false))
})

test('stopMascotDance immediately ends dance', () => {
  useFakeClock()
  startMascotDance(10000)
  assert.ok(isMascotDancing())
  stopMascotDance()
  assert.equal(isMascotDancing(), false)
})
