import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryTools } from '@mini-dsh/core-tools'
import { SkillRegistry } from '@mini-dsh/skills'
import { Telemetry, TokenMeter } from '@mini-dsh/telemetry'
import { boot, DEFAULT_CONFIG } from './index.ts'

// 本文件测"一切皆插件"的集成：所有能力都是插件、配置驱动、loop 可换。

test('一切皆插件：所有能力经 ctx 取，loop 本身是插件', async () => {
  const app = boot()
  for (const key of ['session', 'llm', 'tools', 'prompt', 'skills', 'telemetry', 'cancel', 'compaction', 'subagents', 'workflow', 'agentLoop', 'headless', 'rpc']) {
    assert.ok(app.ctx.get(key) !== undefined, `缺少能力 ${key}`)
  }
  assert.ok(app.pluginNames().includes('agent-loop'))
  assert.ok(app.pluginNames().includes('llm-mock'))
})

test('配置驱动 + 完整回合：回答、事件、遥测都有', async () => {
  const app = boot()
  const result = await app.runHeadless('帮我 echo hi')
  assert.match(result.reply, /结果是 hi/)
  assert.ok(result.events.includes('turn/start'))
  assert.ok(result.events.includes('tool/call'))
  assert.ok(result.events.includes('turn/end'))
  assert.ok(app.ctx.get<Telemetry>('telemetry').query('llm/chat').length >= 2)
  assert.ok(app.ctx.get<TokenMeter>('meter').get().total > 0)
})

test('配置决定插件树：禁用 prompt 则缺该能力', () => {
  const config = JSON.stringify({
    entries: (JSON.parse(DEFAULT_CONFIG) as { entries: Array<{ id: string; name: string }> }).entries
      .map((e) => (e.name === 'prompt' ? { ...e, enabled: false } : e)),
  })
  const app = boot(config)
  assert.ok(!app.pluginNames().includes('prompt'))
  assert.throws(() => app.ctx.get('prompt'), /缺少能力/)
})

test('换 loop = 换配置里的插件，facade 不变', async () => {
  const withV2 = JSON.stringify({
    entries: [
      { id: 's', name: 'session' },
      { id: 'llm', name: 'llm-mock' },
      { id: 'tel', name: 'telemetry' },
      { id: 'cn', name: 'cancellation' },
      { id: 'cp', name: 'compaction' },
      { id: 'loop', name: 'agent-loop-v2' },
      { id: 'h', name: 'headless' },
    ],
  })
  const app = boot(withV2)
  const result = await app.runHeadless('你好')
  assert.equal(result.reply, '[loop-v2] 你好')
  assert.equal(result.steps, 1)
})

test('JSON-RPC / 技能 / 守卫 / 工作流都从插件能力走', async () => {
  const app = boot()
  const run = JSON.parse(await app.rpc().handleLine('{"id":1,"method":"run","params":{"prompt":"帮我 echo hi"}}'))
  assert.match(run.result, /结果是 hi/)
  assert.equal(JSON.parse(await app.rpc().handleLine('{"id":2,"method":"ping"}')).result, 'pong')
  assert.ok((await app.ctx.get<SkillRegistry>('skills').list()).some((s) => s.name === 'code-style'))
  await assert.rejects(() => app.ctx.get<MemoryTools>('tools').execute('write_file', { path: '/etc/passwd', content: 'x' }), /越界/)
  const results = await app.runWorkflow([
    { id: 'a', prompt: 'A' },
    { id: 'b', prompt: 'B', deps: ['a'] },
  ])
  assert.ok(results.has('a') && results.has('b'))
})
