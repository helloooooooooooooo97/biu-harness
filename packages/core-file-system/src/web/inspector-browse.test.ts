import { test } from 'vitest'
import assert from 'node:assert/strict'
import { applyInspectorBrowse, emptyInspectorBrowse } from './inspector-browse.ts'

test('inspector database browse crumbs drop later levels', () => {
  const atRecord = applyInspectorBrowse(
    { collection: '/tasks', viewId: 'board', recordId: 't1' },
    { kind: 'view', collection: '/tasks', viewId: 'board' },
  )
  assert.deepEqual(atRecord, { collection: '/tasks', viewId: 'board' })
  assert.deepEqual(
    applyInspectorBrowse(atRecord, { kind: 'collection', collection: '/pages' }),
    { collection: '/pages' },
  )
  assert.deepEqual(applyInspectorBrowse(atRecord, { kind: 'root' }), emptyInspectorBrowse())
})
