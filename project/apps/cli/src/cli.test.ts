import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMiniDsh } from './index.ts'

// 本文件测"串起来"的集成：配置→服务→loop→遥测→入口。

test('配置驱动 + 完整回合：回答、事件、遥测都有', async () => {
  const app = createMiniDsh()
  const result = await app.runHeadless('帮我 echo hi')
  assert.match(result.reply, /结果是 hi/)
  assert.ok(result.events.includes('turn/start'))
  assert.ok(result.events.includes('tool/call'))
  assert.ok(result.events.includes('turn/end'))
  assert.ok(app.telemetry.query('llm/chat').length >= 2)
  assert.ok(app.meter.get().total > 0)
})

test('JSON-RPC 入口：run / ping / status / workflow', async () => {
  const app = createMiniDsh()
  const run = JSON.parse(await app.rpc.handleLine('{"id":1,"method":"run","params":{"prompt":"帮我 echo hi"}}'))
  assert.match(run.result, /结果是 hi/)
  assert.equal(JSON.parse(await app.rpc.handleLine('{"id":2,"method":"ping"}')).result, 'pong')
  const status = JSON.parse(await app.rpc.handleLine('{"id":3,"method":"status"}')).result
  assert.ok(status.events >= 0)
  assert.ok(status.tokens.total >= 0)
})

test('取消：预取消的 agent 在请求时抛 AbortError', async () => {
  const app = createMiniDsh()
  app.cancel.cancel({ kind: 'user' })
  await assert.rejects(
    () => app.runHeadless('帮我 echo hi'),
    (err: unknown) => (err as Error).name === 'AbortError',
  )
})

test('技能与守卫：skill 工具可用，write_file 出界被拒', async () => {
  const app = createMiniDsh()
  assert.ok((await app.skills.list()).some((s) => s.name === 'code-style'))
  assert.equal(app.tools.list().includes('skill'), true)
  await assert.rejects(
    () => app.tools.execute('write_file', { path: '/etc/passwd', content: 'x' }),
    /越界/,
  )
})

test('子代理工作流：两个任务按依赖执行并收集结果', async () => {
  const app = createMiniDsh()
  const results = await app.runWorkflow([
    { id: 'a', prompt: 'A 任务' },
    { id: 'b', prompt: 'B 任务', deps: ['a'] },
  ])
  assert.ok(results.has('a'))
  assert.ok(results.has('b'))
})
