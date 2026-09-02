import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const shell = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')

test('overlay chat is a resident floating window off the agent page', () => {
  assert.match(shell, /showCenter=\{activeModule === 'agent'\}/)
  const overlay = readFileSync(resolve(import.meta.dirname, './chat-overlay.ts'), 'utf8')
  assert.match(overlay, /isChatPagePath/)
  assert.match(overlay, /requestComposerFocus\(\)/)
  assert.match(shell, /overlayMounted && overlayOpen/)
  assert.match(shell, /chat-overlay-close/)
  assert.match(shell, /closeChatOverlay\(\)/)
  assert.match(shell, /onPointerDown/)
  assert.doesNotMatch(shell, /if \(overlay\) setChatOverlay\(true\)/)
  assert.doesNotMatch(shell, /overlayCollapsed/)
  assert.doesNotMatch(shell, /is-compose-only/)
  assert.doesNotMatch(shell, /is-autohide/)
  assert.doesNotMatch(shell, /chat-overlay-toggle/)
  assert.doesNotMatch(shell, /toggleChatOverlay/)
  assert.doesNotMatch(shell, /chat-overlay-pin/)
  const overlayHead = shell.slice(shell.indexOf('const overlayHeader'))
  assert.match(overlayHead.slice(0, 1600), /chat-view-project/)
  assert.match(overlayHead.slice(0, 1600), /layoutTools/)
  assert.match(overlayHead.slice(0, 1600), /chat-overlay-close/)
  assert.doesNotMatch(overlayHead.slice(0, 1600), /inspector-toggle/)
  assert.match(shell, /data-testid="agent-center"/)
  assert.match(shell, /mountCenter/)
})
