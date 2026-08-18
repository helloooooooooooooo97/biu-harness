import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryTools } from '@mini-dsh/core-tools'
import { SessionLog } from '@mini-dsh/core-session'
import { SystemPromptAssembler } from '@mini-dsh/core-system-prompt'
import { SkillRegistry } from '@mini-dsh/skills'
import { Telemetry, TokenMeter } from '@mini-dsh/telemetry'
import { boot, DEFAULT_CONFIG } from './index.ts'

// 本文件测"基于真实 cordis"的集成：插件树、inject 依赖、换 loop。

test('cordis 插件树：所有能力由插件提供，依赖经 inject 激活', async () => {
  const app = boot()
  await app.ready()
  for (const key of ['session', 'llm', 'tools', 'prompt', 'skills', 'telemetry', 'cancel', 'compaction', 'subagents', 'workflow', 'agentLoop', 'headless', 'rpc']) {
    assert.ok(app.ctx.get(key) !== undefined, `缺少能力 ${key}`)
  }
  assert.ok(app.pluginNames().includes('agent-loop'))
  assert.ok(app.pluginNames().includes('llm-mock'))
  assert.ok(app.pluginNames().includes('tool-echo'))
  assert.ok(app.pluginNames().includes('prompt-identity'))
})

test('配置驱动 + 完整回合：回答、事件、遥测都有', async () => {
  const app = boot()
  const result = await app.runHeadless('帮我 echo hi')
  assert.match(result.reply, /结果是 hi/)
  assert.ok(result.events.includes('turn/start'))
  assert.ok(result.events.includes('tool/call'))
  assert.ok(result.events.includes('turn/end'))
  assert.ok((app.ctx.get('telemetry') as Telemetry).query('llm/chat').length >= 2)
  assert.ok((app.ctx.get('meter') as TokenMeter).get().total > 0)
})

test('配置决定插件树：禁用 prompt 则缺该能力', async () => {
  const config = JSON.stringify({
    entries: (JSON.parse(DEFAULT_CONFIG) as { entries: Array<{ id: string; name: string }> }).entries
      .map((e) => (e.name === 'prompt' ? { ...e, enabled: false } : e)),
  })
  const app = boot(config)
  await app.ready()
  assert.ok(!app.pluginNames().includes('prompt'))
  assert.equal(app.ctx.get('prompt'), undefined)
})

test('换 loop = 换配置里的插件，facade 不变', async () => {
  const withV2 = JSON.stringify({
    entries: [
      { id: 's', name: 'session' },
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

test('JSON-RPC / 技能 / 守卫 / 工作流都从 cordis 能力走', async () => {
  const app = boot()
  await app.ready()
  const run = JSON.parse(await app.rpc().handleLine('{"id":1,"method":"run","params":{"prompt":"帮我 echo hi"}}'))
  assert.match(run.result, /结果是 hi/)
  assert.equal(JSON.parse(await app.rpc().handleLine('{"id":2,"method":"ping"}')).result, 'pong')
  assert.ok((await (app.ctx.get('skills') as SkillRegistry).list()).some((s) => s.name === 'code-style'))
  await assert.rejects(() => (app.ctx.get('tools') as MemoryTools).execute('write_file', { path: '/etc/passwd', content: 'x' }), /越界/)
  const results = await app.runWorkflow([
    { id: 'a', prompt: 'A' },
    { id: 'b', prompt: 'B', deps: ['a'] },
  ])
  assert.ok(results.has('a') && results.has('b'))
})

test('贡献是可逆 effect：卸工具插件不影响 tools 服务', async () => {
  const app = boot()
  await app.ready()
  const tools = app.ctx.get('tools') as MemoryTools
  assert.deepEqual(tools.list().sort(), ['echo', 'skill', 'write_file'])
  await app.pluginManager.remove('t-echo')
  assert.ok(app.ctx.get('tools'))
  assert.deepEqual(tools.list().sort(), ['skill', 'write_file'])
  assert.ok(app.pluginNames().includes('tools'))
  assert.ok(!app.pluginNames().includes('tool-echo'))
})

test('卸 prompt section 后 assembler 仍在，只撤回该段', async () => {
  const app = boot()
  await app.ready()
  const prompt = app.ctx.get('prompt') as SystemPromptAssembler
  assert.match(prompt.assemble({ variables: {} }), /你是 mini-dsh/)
  await app.pluginManager.remove('p-id')
  assert.ok(app.ctx.get('prompt'))
  assert.doesNotMatch(prompt.assemble({ variables: {} }), /你是 mini-dsh/)
  assert.match(prompt.assemble({ variables: {} }), /echo/)
})

test('session 状态与 effect 分离：重载插件不丢日志', async () => {
  const app = boot()
  await app.ready()
  ;(app.ctx.get('session') as SessionLog).append('user/message', { content: 'hi' })
  await app.pluginManager.reload('s')
  assert.equal((app.ctx.get('session') as SessionLog).length, 1)
})
