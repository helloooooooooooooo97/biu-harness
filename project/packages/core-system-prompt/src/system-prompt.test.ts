import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SECTION_ORDER, SystemPromptAssembler } from './index.ts'

// 本文件测 core-system-prompt：① 排序；② complete 接管。

test('section 按 order 排序并拼接', () => {
  const prompt = new SystemPromptAssembler()
  prompt.section({ name: 'persona', order: SECTION_ORDER.PERSONA, text: '你是工程师。' })
  prompt.section({ name: 'tools', order: SECTION_ORDER.TOOL_GUIDANCE, text: '- echo' })
  assert.equal(prompt.assemble({ variables: {} }), '你是工程师。\n\n- echo')
})

test('complete section 成为唯一提示词', () => {
  const prompt = new SystemPromptAssembler()
  prompt.section({ name: 'persona', order: 0, text: '普通' })
  prompt.section({ name: 'boss', order: -100, text: '接管', complete: true })
  assert.equal(prompt.assemble({ variables: {} }), '接管')
})
