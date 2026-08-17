import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ChatClient, toWire } from './chat-client.ts'

test('toWire 把内部消息正确序列化', () => {
  const wire = toWire([
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'echo', arguments: '{}' }] },
    { role: 'tool', toolCallId: 'c1', content: 'ok' },
  ]) as Array<Record<string, unknown>>
  const assistant = wire[1] as { tool_calls: Array<{ id: string }> }
  assert.equal(assistant.tool_calls[0].id, 'c1')
  const tool = wire[2] as { tool_call_id: string }
  assert.equal(tool.tool_call_id, 'c1')
})

test('ChatClient 解析 tool_calls（fake fetch）', async () => {
  const fetchImpl = async (): Promise<Response> => ({
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: '来',
            tool_calls: [{ id: 'c9', type: 'function', function: { name: 'bash', arguments: '{}' } }],
          },
        }],
      }
    },
    async text() {
      return ''
    },
  }) as Response
  const client = new ChatClient({ apiKey: 'sk-test', fetchImpl })
  const reply = await client.chat([{ role: 'user', content: 'hi' }])
  assert.equal(reply.toolCalls[0].name, 'bash')
})
