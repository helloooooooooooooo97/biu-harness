import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ConversationNodeAssembler } from './conversation-node.ts'
import { ClientHmr, SlotRegistry } from './ui-slots.ts'

// 本文件测 UI 即插件：① 注册/渲染；② 缺失抛错；③ HMR 替换；④ 事件驱动。

test('注册并渲染 keyed 组件', () => {
  const slots = new SlotRegistry()
  slots.register('clock', { render: () => '<Clock />' })
  assert.equal(slots.render('clock'), '<Clock />')
  assert.throws(() => slots.render('nope'), /缺少组件/)
})

test('ClientHmr 热替换 renderer', () => {
  const slots = new SlotRegistry()
  const hmr = new ClientHmr(slots)
  slots.register('clock', { render: () => 'v1' })
  const off = hmr.reload('clock', { render: () => 'v2' })
  assert.equal(slots.render('clock'), 'v2')
  off()
  assert.throws(() => slots.render('clock'), /缺少组件/)
})

test('事件驱动：tool/result 渲染 tool 节点', () => {
  const slots = new SlotRegistry()
  slots.register('tool', { render: (data) => `工具结果: ${String((data as { content?: string }).content ?? '')}` })
  slots.register('message', { render: () => '消息节点' })
  const assembler = new ConversationNodeAssembler(slots)
  const html = assembler.renderEvent({ kind: 'tool/result', data: { content: 'ok' } })
  assert.equal(html, '工具结果: ok')
})
