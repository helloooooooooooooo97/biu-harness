import { test } from 'vitest'
import assert from 'node:assert/strict'
import { pickDomAttrs, recordPickKind, viewPickId } from './pick-dom.ts'

test('pickDomAttrs writes the same handles core-pick reads', () => {
  assert.deepEqual(pickDomAttrs('page', 'p000', '页面 1'), {
    'data-biu-kind': 'page',
    'data-biu-id': 'p000',
    'data-biu-label': '页面 1',
  })
  assert.equal(recordPickKind('page'), 'page')
  assert.equal(recordPickKind('tasks'), 'task')
  assert.equal(recordPickKind('plugins'), 'plugin')
  assert.equal(recordPickKind('sessions-db'), 'session')
  assert.equal(recordPickKind(''), 'record')
  assert.equal(viewPickId('/pages', 'v1'), '/pages::v1')
})
