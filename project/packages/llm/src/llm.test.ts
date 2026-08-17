import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AssistantReply, ChatMessage } from './index.ts'

// 本文件测 llm 包的词汇表类型（编译期契约 + 运行时形状）。

test('ChatMessage 与 AssistantReply 的形状可用', () => {
  // 验证消息与回复的基本字段，作为其他包的契约基准。
  const message: ChatMessage = { role: 'user', content: 'hi' }
  const reply: AssistantReply = {
    content: '我来执行。',
    toolCalls: [{ id: 'c1', name: 'echo', arguments: '{}' }],
  }
  assert.equal(message.role, 'user')
  assert.equal(reply.toolCalls[0].id, 'c1')
})
