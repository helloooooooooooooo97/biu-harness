import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AcpProviderMock, InProcessProvider, SubagentRegistry } from './index.ts'

// 本文件测子代理：inprocess、注册表。

const mockLlm = { chat: async () => ({ content: '子代理回答', toolCalls: [] }) } as never

test('InProcessProvider 返回可 await 的结果', async () => {
  const provider = new InProcessProvider(mockLlm)
  assert.equal(await provider.spawn('任务').result, '子代理回答')
})

test('注册表取用与未知 provider', () => {
  const registry = new SubagentRegistry()
  registry.register(new AcpProviderMock())
  assert.equal(registry.get('acp').name, 'acp')
  assert.throws(() => registry.get('nope'), /未知 provider/)
})
