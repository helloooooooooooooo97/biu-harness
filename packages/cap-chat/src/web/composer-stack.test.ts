/**
 * 粘性用户消息不得压过底部输入栏 / dock 悬浮控件。
 * sticky 的 z-index 写在 thread 组件 Tailwind 上（z-[1]）；
 * .chat-composer-dock 用更高的 z-index 保证机轴最顶。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../../..')

describe('composer dock stacking above sticky user', () => {
  it('isolates chat-stage and keeps composer-dock above sticky user z-index', () => {
    const css = readFileSync(resolve(root, 'web/style.css'), 'utf8')
    const shell = readFileSync(resolve(root, 'packages/web-app-shell/src/web/index.tsx'), 'utf8')
    const thread = readFileSync(resolve(root, 'packages/cap-chat/src/web/thread.tsx'), 'utf8')

    expect(css).toMatch(/\.chat-stage\s*\{[^}]*isolation:\s*isolate/s)
    expect(css).toMatch(/\.chat-composer-dock\s*\{[^}]*z-index:\s*20/s)
    expect(thread).toMatch(/sticky top-0 z-\[1\]/)
    expect(shell).toContain('chat-composer-dock')
    expect(shell).not.toMatch(/bottom-0 z-\[2\]/)
  })

  it('compose-only overlay hides the reply thread until send', () => {
    const css = readFileSync(resolve(root, 'web/style.css'), 'utf8')
    const composer = readFileSync(resolve(root, 'packages/cap-chat/src/web/composer.tsx'), 'utf8')
    expect(css).toMatch(/\.chat-overlay-panel\.is-compose-only \.chat-overlay-thread/)
    expect(composer).toContain('revealOverlayThread')
    expect(composer).toContain('biu:composer-focus')
  })

  it('keeps the dock session mascot clickable while the overlay is autohidden', () => {
    const css = readFileSync(resolve(root, 'web/style.css'), 'utf8')
    const shell = readFileSync(resolve(root, 'packages/web-app-shell/src/web/index.tsx'), 'utf8')
    expect(shell).toMatch(/overlayCollapsed = !overlayOpen \|\| hidden/)
    expect(css).toMatch(
      /\.chat-overlay-panel\.is-autohide \.dock-agent-stack,\s*\n\.chat-overlay-panel\.is-autohide \.dock-agent-stack \* \{\s*pointer-events:\s*auto/,
    )
    expect(css).toMatch(/\.chat-overlay-panel\.is-autohide \.composer-pill/)
    expect(css).toMatch(/\.chat-overlay-panel\.is-autohide \.chat-dock-toolbar-start > :not\(\.dock-agent-stack\)/)
  })

  it('squares the composer when pick chips are present', () => {
    const css = readFileSync(resolve(root, 'web/style.css'), 'utf8')
    const composer = readFileSync(resolve(root, 'packages/cap-chat/src/web/composer.tsx'), 'utf8')
    expect(composer).toMatch(/has-chips/)
    expect(css).toMatch(/\.composer-pill\.has-chips[\s\S]*border-radius:\s*var\(--dsw-radius-bubble\)/)
  })

  it('uses the specified chrome palette and pick highlight', () => {
    const css = readFileSync(resolve(root, 'web/style.css'), 'utf8')
    expect(css).toMatch(/--dsw-bg:\s*#191919/)
    expect(css).toMatch(/--dsw-sidebar:\s*#202020/)
    expect(css).toMatch(/--dsw-hover:\s*#2c2c2c/)
    expect(css).toMatch(/--dsw-sidebar-fg:\s*#bcbab6/)
    expect(css).toMatch(/--dsw-sidebar-fg-active:\s*#f0efed/)
    expect(css).toMatch(/--dsw-pick:\s*#2383e2/)
    expect(css).toMatch(/--dsw-pick-fill:\s*rgba\(35,\s*131,\s*226,\s*0\.18\)/)
    expect(css).toMatch(/--dsw-pick-stroke:\s*rgba\(35,\s*131,\s*226/)
    expect(css).toMatch(/\.app-activity-bar[\s\S]*background:\s*var\(--dsw-bg\)/)
    expect(css).toMatch(/\.pick-overlay-box[\s\S]*background:\s*var\(--dsw-pick-fill\)/)
    expect(css).toMatch(/\.pick-overlay-marquee[\s\S]*background:\s*var\(--dsw-pick-fill\)/)
  })

  it('paints the context-clear hist fill as opaque cherry red without blend or color-scheme overrides', () => {
    const css = readFileSync(resolve(root, 'web/style.css'), 'utf8')
    const approvals = readFileSync(resolve(root, 'packages/cap-chat/src/web/approvals.tsx'), 'utf8')
    expect(css).toMatch(/--dsw-chat-hist-fill:\s*#ff3e51/)
    expect(css).toMatch(/\.project-chip-hist-bar\s*\{[^}]*background:\s*var\(--dsw-chat-hist-fill\)/s)
    expect(css).not.toMatch(/\.project-chip-hist-bar\s*\{[^}]*color-scheme:/s)
    expect(css).not.toMatch(/\.project-chip-hist-bar\s*\{[^}]*mix-blend-mode:/s)
    expect(approvals).toMatch(/project-chip-hist-bar/)
    expect(approvals).not.toMatch(/backgroundColor/)
  })

  it('paints inspector trajectory and usage on the same sidebar token as the left rail', () => {
    const css = readFileSync(resolve(root, 'web/style.css'), 'utf8')
    expect(css).toMatch(/\.traj-root\s*\{[^}]*background:\s*var\(--dsw-sidebar\)/s)
    expect(css).toMatch(/\[data-testid='session-inspector'\] \.usage-panel\s*\{[^}]*background:\s*var\(--dsw-sidebar\)/s)
  })

  it('keeps pick chips from inheriting the composer line-height', () => {
    const css = readFileSync(resolve(root, 'web/style.css'), 'utf8')
    expect(css).toMatch(/\.composer-inline-chip\s*\{[^}]*align-items:\s*center/s)
    expect(css).toMatch(/\.composer-inline-chip\s*\{[^}]*vertical-align:\s*middle/s)
    expect(css).toMatch(/\.composer-inline-chip\s*\{[^}]*line-height:\s*1/s)
    expect(css).toMatch(/\.composer-tool-chip\.is-pick,\s*\n\.user-pick-chip\s*\{[^}]*line-height:\s*1/s)
    expect(css).toMatch(/\.pick-kind-icon\s*\{[^}]*display:\s*block/s)
    expect(css).toMatch(
      /\.composer-pill\.has-chips \.composer-tiptap p,\s*\n\.composer-tiptap\.is-readonly p \{\s*line-height:\s*1\.45/,
    )
  })

  it('uses Tiptap for inline pick chips in the composer', () => {
    const composer = readFileSync(resolve(root, 'packages/cap-chat/src/web/composer.tsx'), 'utf8')
    const node = readFileSync(resolve(root, 'packages/cap-chat/src/web/composer-pick-node.tsx'), 'utf8')
    expect(composer).toMatch(/useEditor/)
    expect(composer).toMatch(/composerDocExtensions/)
    expect(composer).toMatch(/EditorContent/)
    expect(composer).toMatch(/insertPickChips/)
    expect(node).not.toMatch(/ReactNodeViewRenderer/)
    expect(node).toMatch(/queueMicrotask/)
  })
})
