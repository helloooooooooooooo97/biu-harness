import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Agent } from './agent.ts'

// 本文件测 Agent：① followup/steer 唤醒；② inject 不唤醒；③ settle 回 idle。

test('followup 与 steer 唤醒 agent', () => {
  // 验证唤醒语义：普通追问与插队指导都会让状态变 running。
  const agent = new Agent('a1')
  assert.equal(agent.status, 'idle')
  agent.followup('继续')
  assert.equal(agent.status, 'running')
  agent.settle()
  agent.steer('别用 bash')
  assert.equal(agent.status, 'running')
})

test('inject 不唤醒 idle 的 agent', () => {
  // 验证注入语义：上下文先备着，不打断当前工作。
  const agent = new Agent('a1')
  agent.inject('文件已变更')
  assert.equal(agent.status, 'idle')
  assert.equal(agent.inbox.isEmpty, false, '消息已排队')
})

test('settle 让 agent 回到 idle', () => {
  // 验证状态复位：驱动空闲后状态回 idle（第 42 课真实化）。
  const agent = new Agent('a1')
  agent.followup('hi')
  assert.equal(agent.status, 'running')
  agent.settle()
  assert.equal(agent.status, 'idle')
})
