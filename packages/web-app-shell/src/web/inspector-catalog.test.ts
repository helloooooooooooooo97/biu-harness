import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const inspector = readFileSync(resolve(import.meta.dirname, './session-inspector.tsx'), 'utf8')

test('inspector header keeps opened tabs on top and a plus menu on the right', () => {
  assert.match(inspector, /data-testid="inspector-add"/)
  assert.match(inspector, /data-testid="inspector-add-menu"/)
  assert.match(inspector, /className="app-side-bar-head"/)
  assert.match(inspector, /PlusIcon/)
  assert.match(inspector, /点右上角加号/)
  assert.match(inspector, /item.Tab/)
  assert.match(inspector, /inspectorViewProps/)
})
