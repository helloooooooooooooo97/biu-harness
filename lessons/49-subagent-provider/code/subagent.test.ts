import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SubagentRegistry } from './subagent.ts'
import { AcpProviderMock, InProcessProvider } from './providers.ts'
import type { LlmClient } from './types.ts'

// 本文件测子代理：① inprocess；② 注册表；③ 句柄。

const mockLlm: LlmClient = {
  async chat() {
    return { content: '子代理回答', toolCalls: [] }
  },
}

test('InProcessProvider 返回可 await 的结果', async () => {
  const provider = new InProcessProvider(mockLlm)
  const handle = provider.spawn('任务')
  assert.match(handle.id, /^sub-/)
  assert.equal(await handle.result, '子代理回答')
})

test('注册表注册/取用/换 Provider', async () => {
  const registry = new SubagentRegistry()
  registry.register(new InProcessProvider(mockLlm))
  registry.register(new AcpProviderMock('远程'))
  assert.equal(registry.get('inprocess').name, 'inprocess')
  const remote = registry.get('acp').spawn('统计')
  assert.match(await remote.result, /^远程/)
  assert.throws(() => registry.get('nope'), /未知 provider/)
})

test('id 唯一', () => {
  const provider = new AcpProviderMock()
  const a = provider.spawn('a')
  const b = provider.spawn('b')
  assert.notEqual(a.id, b.id)
})
