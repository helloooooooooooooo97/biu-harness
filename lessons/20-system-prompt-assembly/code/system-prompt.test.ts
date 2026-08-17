import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SECTION_ORDER, SystemPromptAssembler } from './system-prompt.ts'

// 本文件测 SystemPromptAssembler：① 排序拼接；② 去重/卸载；③ 动态文本；④ complete 接管；⑤ 插值；⑥ context 追加。

const emptyCtx = { variables: {} }

test('section 按 order 排序并拼接', () => {
  // 验证顺序与内容：tools（100）在 persona（0）之后。
  const prompt = new SystemPromptAssembler()
  prompt.section({ name: 'persona', order: SECTION_ORDER.PERSONA, text: '你是工程师。' })
  prompt.section({ name: 'tools', order: SECTION_ORDER.TOOL_GUIDANCE, text: '- bash' })
  const result = prompt.assemble(emptyCtx)
  assert.equal(result, '你是工程师。\n\n- bash')
})

test('重复 section 抛错，disposer 可卸载', () => {
  // 验证名字唯一性与可逆注册：重名拒绝；卸载后从组装结果消失。
  const prompt = new SystemPromptAssembler()
  prompt.section({ name: 'identity', order: -100, text: 'A' })
  assert.throws(() => prompt.section({ name: 'identity', order: -100, text: 'B' }), /重复的 section: identity/)
  const off = prompt.section({ name: 'extra', order: 50, text: 'X' })
  off()
  assert.equal(prompt.assemble(emptyCtx), 'A')
})

test('函数式 text 按组装上下文求值', () => {
  // 验证动态 section：text 是函数时每次组装拿到当时的 ctx。
  const prompt = new SystemPromptAssembler()
  prompt.section({
    name: 'runtime',
    order: SECTION_ORDER.RUNTIME_CONTEXT,
    text: (ctx) => `会话: ${ctx.agentId ?? '未知'}`,
  })
  assert.equal(prompt.assemble({ agentId: 'a1', variables: {} }), '会话: a1')
})

test('complete section 成为唯一提示词，多个 complete 抛错', () => {
  // 验证接管语义：complete 存在时其他 section 被忽略；两个 complete 是配置错误。
  const prompt = new SystemPromptAssembler()
  prompt.section({ name: 'persona', order: 0, text: '普通提示词' })
  prompt.section({ name: 'boss', order: -100, text: '只由我接管', complete: true })
  assert.equal(prompt.assemble(emptyCtx), '只由我接管')

  const bad = new SystemPromptAssembler()
  bad.section({ name: 'a', order: 0, text: 'x', complete: true })
  bad.section({ name: 'b', order: 1, text: 'y', complete: true })
  assert.throws(() => bad.assemble(emptyCtx), /多个 complete section/)
})

test('render 做 {{变量}} 插值', () => {
  // 验证变量替换：命中的替换为真实值，未命中的替换为空。
  const prompt = new SystemPromptAssembler()
  assert.equal(prompt.render('工作目录 {{cwd}}，模型 {{model}}', { cwd: '/home/u' }), '工作目录 /home/u，模型 ')
})

test('context 按 order 追加在 sections 之后', () => {
  // 验证 PromptContext：动态上下文永远跟在静态 sections 后面。
  const prompt = new SystemPromptAssembler()
  prompt.section({ name: 'identity', order: -100, text: '身份' })
  prompt.context({ name: 'file-change', order: 200, text: () => '文件已变更：README.md' })
  assert.equal(prompt.assemble(emptyCtx), '身份\n\n文件已变更：README.md')
})
