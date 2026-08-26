/**
 * 回归保护：chat 主滚动容器（.chat-stage）此前用浏览器原生默认滚动条，
 * thumb 宽度取决于系统/浏览器默认（macOS overlay scrollbar 偏粗），用户不喜欢这种过宽样式。
 *
 * 修复（web/style.css）：给 .chat-stage 加"更细"的自定义滚动条
 * （WebKit ::-webkit-scrollbar 固定窄宽 + 标准 scrollbar-width:thin 兼顾 Firefox），
 * 颜色与暗色 UI 统一，hover/滚动时显现，不改变原有布局与交互。
 * 下面用源码断言保证该细滚动条样式不被后续改动误删。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../../..')

const styleCss = () => readFileSync(resolve(root, 'web/style.css'), 'utf8')

describe('chat scrollbar: slim custom thumb on .chat-stage', () => {
  it('defines a custom ::-webkit-scrollbar with a fixed narrow width (slim, not the default fat bar)', () => {
    const css = styleCss()
    // 固定窄轨道宽度，让 thumb 变细；宽度固定，不随内容/系统默认变化
    expect(css).toMatch(/\.chat-stage::-webkit-scrollbar\s*\{[^}]*width:\s*10px/s)
    expect(css).toMatch(/\.chat-stage::-webkit-scrollbar-thumb\s*\{/s)
  })

  it('keeps standard (non-WebKit) scrollbars thin & theme-aligned for consistency', () => {
    const css = styleCss()
    // Firefox 等标准引擎：narrow 宽度 + 主题色
    expect(css).toMatch(/\.chat-stage\s*\{[^}]*scrollbar-width:\s*thin/s)
    expect(css).toMatch(/\.chat-stage\s*\{[^}]*scrollbar-color:/s)
  })

  it('keeps scrollbar-gutter stable so layout does not shift when the bar appears', () => {
    const css = styleCss()
    expect(css).toMatch(/\.chat-stage\s*\{[^}]*scrollbar-gutter:\s*stable/s)
  })
})
