import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const inspector = readFileSync(resolve(import.meta.dirname, './session-inspector.tsx'), 'utf8')

test('inspector starts as a catalog and only renders a panel after a pick', () => {
  assert.match(inspector, /useState\(''\)/)
  assert.match(inspector, /data-testid="inspector-catalog"/)
  assert.match(inspector, /可打开/)
  assert.match(inspector, /setTab\(active \? '' : item\.id\)/)
})
