import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMiniDsh, runDemo } from './index.ts'

// 本文件测 CLI 装配：① 组合可用；② 完整回合跑通（mock 离线）。

test('createMiniDsh 装配全部包', () => {
  const app = createMiniDsh()
  assert.ok(app.session)
  assert.ok(app.prompt)
  assert.ok(app.pre)
  assert.ok(app.agent)
  assert.ok(app.turn)
})

test('runDemo 用 mock 跑通完整回合', async () => {
  const { reply, events, prompt } = await runDemo('帮我 echo hi')
  assert.match(reply, /结果是 hi/)
  assert.ok(events.includes('turn/start'))
  assert.ok(events.includes('turn/end'))
  assert.ok(events.includes('tool/call'))
  assert.match(prompt, /你是 mini-dsh/)
})
