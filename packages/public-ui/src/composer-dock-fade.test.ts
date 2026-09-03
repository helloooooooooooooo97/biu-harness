import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  COMPOSER_BLUR_FADE_MS,
  COMPOSER_BOTTOM_HOT_PX,
  ensureComposerDockFade,
} from './composer-dock-fade.ts'

test('composer dock fades one second after focus leaves the dock', async () => {
  const dock = document.createElement('div')
  dock.className = 'chat-composer-dock'
  const input = document.createElement('input')
  dock.append(input)
  document.body.append(dock)

  const stop = ensureComposerDockFade()
  input.focus()
  assert.equal(dock.classList.contains('is-composer-faded'), false)

  input.blur()
  assert.equal(dock.classList.contains('is-composer-faded'), false)

  await new Promise((resolve) => window.setTimeout(resolve, COMPOSER_BLUR_FADE_MS - 50))
  assert.equal(dock.classList.contains('is-composer-faded'), false)

  await new Promise((resolve) => window.setTimeout(resolve, 100))
  assert.equal(dock.classList.contains('is-composer-faded'), true)

  stop?.()
  assert.equal(dock.classList.contains('is-composer-faded'), false)
  assert.equal(COMPOSER_BLUR_FADE_MS, 1000)
  dock.remove()
})

test('refocusing the composer cancels a pending fade', async () => {
  const dock = document.createElement('div')
  dock.className = 'chat-composer-dock'
  const input = document.createElement('input')
  dock.append(input)
  document.body.append(dock)

  ensureComposerDockFade()
  input.focus()
  input.blur()
  await new Promise((resolve) => window.setTimeout(resolve, 400))
  input.focus()
  await new Promise((resolve) => window.setTimeout(resolve, COMPOSER_BLUR_FADE_MS))
  assert.equal(dock.classList.contains('is-composer-faded'), false)
  dock.remove()
})

test('hovering the bottom hot zone reveals a faded composer dock', async () => {
  const dock = document.createElement('div')
  dock.className = 'chat-composer-dock is-composer-faded'
  const input = document.createElement('input')
  dock.append(input)
  document.body.append(dock)

  ensureComposerDockFade()
  const y = window.innerHeight - Math.floor(COMPOSER_BOTTOM_HOT_PX / 2)
  document.dispatchEvent(new PointerEvent('pointermove', { clientY: y, bubbles: true }))
  assert.equal(dock.classList.contains('is-composer-faded'), false)
  dock.remove()
})

test('clicking a faded composer dock reveals it and requests focus', async () => {
  const host = document.createElement('div')
  host.className = 'session-composer-host'
  const dock = document.createElement('div')
  dock.className = 'chat-composer-dock is-composer-faded'
  const input = document.createElement('input')
  dock.append(input)
  host.append(dock)
  document.body.append(host)

  let focusRequested = false
  const onFocus = () => {
    focusRequested = true
  }
  window.addEventListener('biu:composer-focus', onFocus)

  ensureComposerDockFade()
  dock.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  assert.equal(dock.classList.contains('is-composer-faded'), false)
  assert.equal(focusRequested, true)

  window.removeEventListener('biu:composer-focus', onFocus)
  host.remove()
})
