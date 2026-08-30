import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const renderer = readFileSync(resolve(import.meta.dirname, './renderer.tsx'), 'utf8')

test('unknown paths do not bounce to home before plugins register', () => {
  assert.doesNotMatch(renderer, /Navigate to="\/"/)
  assert.doesNotMatch(renderer, /isKnownAppPath/)
})
