import { test } from 'vitest'
import assert from 'node:assert/strict'
import { getInspectorCaption, reportInspectorCaption, subscribeInspectorCaptions } from './inspector-captions.ts'

test('inspector captions remember leaf labels per pane', async () => {
  let hits = 0
  const off = subscribeInspectorCaptions(() => {
    hits += 1
  })
  reportInspectorCaption('database::a', { label: '新视图', kind: 'view', mode: 'queue' })
  await Promise.resolve()
  assert.equal(getInspectorCaption('database::a')?.label, '新视图')
  assert.equal(getInspectorCaption('database::a')?.mode, 'queue')
  assert.ok(hits > 0)
  off()
})
