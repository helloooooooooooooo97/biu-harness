import { test } from 'vitest'
import assert from 'node:assert/strict'
import { bindComposerBlurFade, COMPOSER_BLUR_FADE_MS } from './composer-blur-fade.ts'

test('composer dock fades out 1s after blur', () => {
  const dock = document.createElement('div')
  dock.className = 'chat-composer-dock'
  const input = document.createElement('input')
  dock.append(input)
  document.body.append(dock)
  const stop = bindComposerBlurFade(dock)
  input.focus()
  input.blur()
  assert.equal(dock.classList.contains('is-blur-faded'), false)
  assert.equal(COMPOSER_BLUR_FADE_MS, 1000)
  stop()
  dock.remove()
})
