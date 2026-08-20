import { test } from 'vitest'
import assert from 'node:assert/strict'
import { act } from 'react'

test('boots into #app', async () => {
  document.body.innerHTML = '<div id="app"></div>'
  globalThis.fetch = (async () => new Response(JSON.stringify({
    plugins: [],
    pages: [],
    routes: [],
    events: [],
    services: [],
  }))) as typeof fetch
  await act(async () => {
    await import('./main.tsx')
  })
  assert.match(document.body.innerHTML, /deepseek/i)
  assert.match(document.body.innerHTML, /HARNESS/)
  assert.match(document.body.innerHTML, /Settings|New Session/)
})
