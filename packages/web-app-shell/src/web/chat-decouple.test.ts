import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const shell = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')

test('overlay chat is off on the agent page and elsewhere until pick attaches', () => {
  assert.match(shell, /showCenter=\{activeModule === 'agent'\}/)
  assert.match(shell, /floating=\{activeModule !== 'agent'\}/)
  assert.match(shell, /overlayCollapsed = !overlayOpen \|\| hidden/)
  assert.match(shell, /overlay && overlayMounted/)
  assert.doesNotMatch(shell, /overlay && overlayMounted && overlayOpen/)
  assert.match(shell, /is-compose-only/)
  assert.doesNotMatch(shell, /setChatOverlay\(true\)/)
  assert.doesNotMatch(shell, /openOverlayComposer\(\{ revealThread: true \}\)/)
  assert.doesNotMatch(shell, /chat-overlay-toggle/)
  assert.doesNotMatch(shell, /toggleChatOverlay/)
  assert.doesNotMatch(shell, /放大聊天窗口/)
  const overlayHead = shell.slice(shell.indexOf('const overlayHeader'))
  assert.doesNotMatch(overlayHead.slice(0, 1200), /inspector-toggle/)
  assert.match(shell, /overlayStillHoldsPointer/)
  assert.doesNotMatch(shell, /chat-composer-dock pointer-events-none">\{overlayDock\}/)
  assert.match(shell, /heldCenter/)
  assert.match(shell, /data-testid="agent-center"/)
  assert.match(shell, /mountCenter/)
})
