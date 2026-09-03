import { test } from 'vitest'
import assert from 'node:assert/strict'
import { bindChatScrollFade, COMPOSER_SCROLL_FADE_MS } from './composer-scroll-fade.ts'

test('chat scroll fades composer docks until scrolling pauses', () => {
  const stage = document.createElement('div')
  Object.defineProperty(stage, 'clientHeight', { value: 400 })
  stage.scrollTop = 0
  const dock = document.createElement('div')
  dock.className = 'chat-composer-dock'
  document.body.append(stage, dock)
  const stop = bindChatScrollFade(stage)
  stage.scrollTop = 40
  stage.dispatchEvent(new Event('scroll'))
  assert.equal(dock.classList.contains('is-scroll-faded'), true)
  stop()
  assert.equal(dock.classList.contains('is-scroll-faded'), false)
  assert.equal(COMPOSER_SCROLL_FADE_MS, 220)
  dock.remove()
  stage.remove()
})
