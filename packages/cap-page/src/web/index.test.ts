import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { apply, name } from './index.ts'

test('page web no longer owns the document editor', () => {
  assert.equal(name, 'page-ui')
  assert.equal(typeof apply, 'function')
  const src = readFileSync(resolve(import.meta.dirname, './index.ts'), 'utf8')
  assert.match(src, /@biu\/core-editor\/web/)
  assert.doesNotMatch(src, /ui\.decorate\('\/pages'/)
})
