/**
 * 回归保护：全站上下滚动条与聊天页同一套细条（web/style.css 全局 *）。
 * WebKit 固定 10px 轨宽 + Firefox scrollbar-width:thin；.chat-stage 另保 gutter。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../../..')

const styleCss = () => readFileSync(resolve(root, 'web/style.css'), 'utf8')

describe('slim custom scrollbars (chat-style, app-wide)', () => {
  it('defines a custom ::-webkit-scrollbar with a fixed narrow width on all elements', () => {
    const css = styleCss()
    expect(css).toMatch(/\*::-webkit-scrollbar\s*\{[^}]*width:\s*10px/s)
    expect(css).toMatch(/\*::-webkit-scrollbar-thumb\s*\{/s)
  })

  it('keeps standard (non-WebKit) scrollbars thin & theme-aligned for consistency', () => {
    const css = styleCss()
    expect(css).toMatch(/\*\s*\{[^}]*scrollbar-width:\s*thin/s)
    expect(css).toMatch(/\*\s*\{[^}]*scrollbar-color:/s)
  })

  it('keeps scrollbar-gutter stable on .chat-stage so layout does not shift when the bar appears', () => {
    const css = styleCss()
    expect(css).toMatch(/\.chat-stage\s*\{[^}]*scrollbar-gutter:\s*stable/s)
  })
})
