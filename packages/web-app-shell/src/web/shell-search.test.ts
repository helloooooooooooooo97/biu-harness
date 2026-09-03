import { test } from 'vitest'
import assert from 'node:assert/strict'
import { SEARCH_SCOPES, openSearchHit, searchCollection, searchHref } from './shell-search.tsx'

test('search opens inspector collections, not chat or database routes', () => {
  assert.equal(searchCollection('session'), '/sessions')
  assert.equal(searchCollection('task'), '/tasks')
  assert.equal(searchCollection('page'), '/pages')
  assert.equal(searchCollection('plugin'), '/plugins')
  assert.equal(searchCollection('facet'), '/facets')
  assert.deepEqual(
    SEARCH_SCOPES.map((item) => item.label),
    ['会话', '任务', '页面', '插件', '类型'],
  )
})

test('openSearchHit reveals the record in the inspector', () => {
  const seen: Array<{ collection?: string; recordId?: string }> = []
  const onReveal = (event: Event) => {
    const detail = (event as CustomEvent).detail as { collection?: string; recordId?: string }
    seen.push(detail)
  }
  window.addEventListener('biu:inspector-reveal', onReveal)
  openSearchHit({ kind: 'page', id: 'p1' })
  openSearchHit({ kind: 'session', id: 'abc' })
  window.removeEventListener('biu:inspector-reveal', onReveal)
  assert.deepEqual(seen, [
    { collection: '/pages', recordId: 'p1' },
    { collection: '/sessions', recordId: 'abc' },
  ])
})

test('searchHref opens the left main pane by changing the route', () => {
  assert.equal(searchHref({ kind: 'session', id: 'abc' }), '/s/abc')
  assert.equal(searchHref({ kind: 'page', id: 'p1' }), '/database/pages/record/p1')
  assert.equal(searchHref({ kind: 'task', id: 't1' }), '/database/tasks/record/t1')
  assert.equal(searchHref({ kind: 'plugin', id: 'g1' }), '/database/plugins/record/g1')
  assert.equal(searchHref({ kind: 'facet', id: 'f1' }), '/database/facets/record/f1')
})
