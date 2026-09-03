import { test } from 'vitest'
import assert from 'node:assert/strict'
import { COMPOSER_BLUR_FADE_MS, ensureComposerDockFade } from './composer-dock-fade.ts'

function mountDock(zoneClass = '') {
  const zone = document.createElement('div')
  zone.className = `composer-dock-zone ${zoneClass}`.trim()
  const dock = document.createElement('div')
  dock.className = 'chat-composer-dock'
  const input = document.createElement('input')
  dock.append(input)
  zone.append(dock)
  document.body.append(zone)
  return { zone, dock, input }
}

test('composer dock fades one second after focus leaves the dock', async () => {
  const { dock, input } = mountDock()
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
  dock.parentElement?.remove()
})

test('refocusing the composer cancels a pending fade', async () => {
  const { dock, input } = mountDock()
  ensureComposerDockFade()
  input.focus()
  input.blur()
  await new Promise((resolve) => window.setTimeout(resolve, 400))
  input.focus()
  await new Promise((resolve) => window.setTimeout(resolve, COMPOSER_BLUR_FADE_MS))
  assert.equal(dock.classList.contains('is-composer-faded'), false)
  dock.parentElement?.remove()
})

test('hovering one dock zone reveals only that dock before focus', () => {
  const left = mountDock()
  const right = mountDock('session-composer-host')
  left.dock.classList.add('is-composer-faded')
  right.dock.classList.add('is-composer-faded')

  ensureComposerDockFade()
  left.zone.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  assert.equal(left.dock.classList.contains('is-composer-faded'), false)
  assert.equal(right.dock.classList.contains('is-composer-faded'), true)

  left.zone.remove()
  right.zone.remove()
})

test('clicking a faded session composer dock only reveals that dock', () => {
  const host = document.createElement('div')
  host.className = 'session-composer-host composer-dock-zone'
  const dock = document.createElement('div')
  dock.className = 'chat-composer-dock is-composer-faded'
  const editor = document.createElement('div')
  editor.className = 'ProseMirror'
  editor.setAttribute('contenteditable', 'true')
  dock.append(editor)
  host.append(dock)

  const overlayZone = document.createElement('div')
  overlayZone.className = 'composer-dock-zone'
  const overlay = document.createElement('div')
  overlay.className = 'chat-composer-dock is-composer-faded'
  overlay.append(document.createElement('span'))
  overlayZone.append(overlay)

  document.body.append(host, overlayZone)

  ensureComposerDockFade()
  dock.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  assert.equal(dock.classList.contains('is-composer-faded'), false)
  assert.equal(overlay.classList.contains('is-composer-faded'), true)
  assert.equal(document.activeElement, editor)

  host.remove()
  overlayZone.remove()
})
