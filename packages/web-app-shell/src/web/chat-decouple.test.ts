import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const shell = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')

test('overlay chat coexists with the center chat and has no enlarge or sidebar buttons', () => {
  assert.match(shell, /showCenter=\{activeModule === 'agent'\}/)
  assert.match(shell, /floating/)
  assert.doesNotMatch(shell, /chat-overlay-toggle/)
  assert.doesNotMatch(shell, /toggleChatOverlay/)
  assert.doesNotMatch(shell, /放大聊天窗口/)
  const overlayHead = shell.slice(shell.indexOf('const overlayHeader'))
  assert.doesNotMatch(overlayHead.slice(0, 1200), /inspector-toggle/)
})
