/**
 * 粘性用户消息不得压过底部输入栏 / dock 悬浮控件。
 * sticky 的 z-index 被关在 .chat-stage（isolation）内；
 * .chat-composer-dock 用更高的 z-index 保证机轴最顶。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../..')

describe('composer dock stacking above sticky user', () => {
  it('isolates chat-stage and keeps composer-dock above sticky user z-index', () => {
    const css = readFileSync(resolve(root, 'src/style.css'), 'utf8')
    const shell = readFileSync(resolve(root, 'src/plugins/contributors/shell.tsx'), 'utf8')

    expect(css).toMatch(/\.chat-stage\s*\{[^}]*isolation:\s*isolate/s)
    expect(css).toMatch(/\.chat-composer-dock\s*\{[^}]*z-index:\s*20/s)
    expect(css).toMatch(
      /\.chat-msg-row\[data-chat-kind='user'\]\s*\{[^}]*z-index:\s*1(?:\s|;|})/s,
    )
    expect(shell).toContain('chat-composer-dock')
    expect(shell).not.toMatch(/bottom-0 z-\[2\]/)
  })
})
