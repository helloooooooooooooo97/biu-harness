import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ClientHmr, ConversationNodeAssembler, SlotRegistry } from './index.ts'

// 本文件测 ui-slots：注册/渲染、HMR 替换、事件驱动。

test('注册渲染与 HMR 替换', () => {
  const slots = new SlotRegistry()
  slots.register('clock', { render: () => 'v1' })
  const hmr = new ClientHmr(slots)
  hmr.reload('clock', { render: () => 'v2' })
  assert.equal(slots.render('clock'), 'v2')
})

test('事件驱动渲染 tool 节点', () => {
  const slots = new SlotRegistry()
  slots.register('tool', { render: (d) => `工具: ${String((d as { content?: string }).content ?? '')}` })
  slots.register('message', { render: () => '消息' })
  const assembler = new ConversationNodeAssembler(slots)
  assert.equal(assembler.renderEvent({ kind: 'tool/result', data: { content: 'ok' } }), '工具: ok')
})
