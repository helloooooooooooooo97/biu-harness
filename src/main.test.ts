import { test } from 'vitest'
import assert from 'node:assert/strict'
import { act } from 'react'

test('boots into #app', async () => {
  document.body.innerHTML = '<div id="app"></div>'
  await act(async () => {
    await import('./main.tsx')
  })
  assert.match(document.body.innerHTML, /问候/)
  assert.match(document.body.innerHTML, /hmr-dev/)
})
