/**
 * 回归保护：chat 主滚动容器（.chat-stage）存在"默认粗滚动条 thumb 偶发异常变大"的历史缺陷。
 * 根因：.chat-stage 用浏览器默认滚动条，thumb 由 clientHeight/scrollHeight 实时决定；
 * 叠加 reply/turn 节点的 content-visibility:auto（contain-intrinsic-size:auto 160px）在
 * 流式/滚动/开关检查器时 scrollHeight 抖动，默认 thumb 会随之忽大忽小甚至撑满。
 *
 * 修复采用"锚定细条"兜底：给 .chat-stage 加固定窄 thumb 的自定义滚动条（WebKit+标准）。
 * 只要内容总量超出视口就始终是一根恒定细长的白色半透明条，不再随 scrollHeight 突变。
 * 下面用源码断言保证该兜底样式不被后续改动误删。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../../..')

const styleCss = () => readFileSync(resolve(root, 'web/style.css'), 'utf8')
const threadTsx = () => readFileSync(resolve(root, 'packages/cap-chat/src/web/thread.tsx'), 'utf8')

describe('chat scrollbar: anchored thin thumb on .chat-stage', () => {
  it('defines a custom ::-webkit-scrollbar with fixed narrow width (not the default fat bar)', () => {
    const css = styleCss()
    // 固定窄轨道宽度，使 thumb 视觉恒定，不再随 scrollHeight/clientHeight 变大
    expect(css).toMatch(/\.chat-stage::-webkit-scrollbar\s*\{[^}]*width:\s*10px/s)
    expect(css).toMatch(/\.chat-stage::-webkit-scrollbar-thumb\s*\{/s)
  })

  it('keeps standard (non-WebKit) scrollbars thin & theme-aligned for consistency', () => {
    const css = styleCss()
    expect(css).toMatch(/\.chat-stage\s*\{[^}]*scrollbar-width:\s*thin/s)
    expect(css).toMatch(/\.chat-stage\s*\{[^}]*scrollbar-color:/s)
  })

  it('keeps scrollbar-gutter stable so layout does not shift when the bar toggles', () => {
    const css = styleCss()
    expect(css).toMatch(/\.chat-stage\s*\{[^}]*scrollbar-gutter:\s*stable/s)
  })

  it('records that off-screen nodes use content-visibility with intrinsic 160px estimate (root cause of scrollHeight jitter)', () => {
    // 修复方向是"兜底锚定细条"；此处登记根因来源，防止后续把估算调大/调小再引入比例抖动
    expect(threadTsx()).toMatch(/content-visibility:auto/)
    expect(threadTsx()).toMatch(/contain-intrinsic-size:auto_160px/)
    // 修复必须仍在：chat-stage 的滚动条穿透性兜底存在于全局样式而非仅组件内联类
    expect(styleCss()).toMatch(/\.chat-stage::-webkit-scrollbar/)
  })
})
