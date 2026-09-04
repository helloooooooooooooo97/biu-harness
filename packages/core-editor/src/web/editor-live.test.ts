import { test } from 'vitest'
import assert from 'node:assert/strict'
import { editorHostIsLive, slashMayOpen } from './editor-live.ts'

test('slash stays closed when the page editor is hidden or unfocused', () => {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  const dom = document.createElement('div')
  host.append(dom)
  document.body.append(host)
  const hidden = { isDestroyed: false, isFocused: true, view: { dom }, isActive: () => false }
  assert.equal(editorHostIsLive(hidden), false)
  assert.equal(slashMayOpen(hidden), false)
  host.remove()

  const liveDom = document.createElement('div')
  document.body.append(liveDom)
  const unfocused = { isDestroyed: false, isFocused: false, view: { dom: liveDom }, isActive: () => false }
  assert.equal(editorHostIsLive(unfocused), true)
  assert.equal(slashMayOpen(unfocused), false)
  const focused = { ...unfocused, isFocused: true }
  assert.equal(slashMayOpen(focused), true)
  liveDom.remove()
})
