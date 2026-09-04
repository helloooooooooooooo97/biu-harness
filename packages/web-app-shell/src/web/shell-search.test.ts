import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  SEARCH_SCOPES,
  openSearchHit,
  pickRecentHits,
  recordUpdatedAt,
  searchCollection,
  searchHref,
  tagsFromRecord,
} from './shell-search.tsx'

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

test('search hits collect tags from tags, facet.tags, and config.tags', () => {
  assert.deepEqual(tagsFromRecord({ tags: ['a', 'b'] }), ['a', 'b'])
  assert.deepEqual(tagsFromRecord({ facet: { tags: ['dp'] } }), ['dp'])
  assert.deepEqual(tagsFromRecord({ config: { tags: ['host-ui'] } }), ['host-ui'])
  assert.deepEqual(tagsFromRecord({ tags: ['a'], facet: { tags: ['a', 'b'] } }), ['a', 'b'])
})

test('recordUpdatedAt prefers updatedAt then createdAt', () => {
  assert.equal(recordUpdatedAt({ updatedAt: 9, createdAt: 1 }), 9)
  assert.equal(recordUpdatedAt({ createdAt: 4 }), 4)
  assert.equal(recordUpdatedAt({}), 0)
})

test('pickRecentHits takes the newest records per kind', () => {
  assert.deepEqual(
    pickRecentHits(
      [
        { id: 'old', updatedAt: 1 },
        { id: 'new', updatedAt: 9 },
        { id: 'mid', updatedAt: 5 },
      ],
      2,
    ).map((item) => item.id),
    ['new', 'mid'],
  )
})

test('empty search lists every kind by updatedAt instead of skipping remotes', () => {
  const src = readFileSync(resolve(import.meta.dirname, './shell-search.tsx'), 'utf8')
  assert.doesNotMatch(src, /if \(!needle && scope === 'all'\) \{\s*setHits\(\[\]\)/)
  assert.match(src, /sort: 'updatedAt'/)
  assert.match(src, /item.id === 'session' \? '\/sessions'/)
  assert.match(src, /空着时会话、任务、页面、插件、类型各按更新时间列最近/)
})

test('session task page plugin hits render record tags on the right, not kind chips', () => {
  const src = readFileSync(resolve(import.meta.dirname, './shell-search.tsx'), 'utf8')
  assert.doesNotMatch(src, /HitKindTag/)
  assert.match(src, /HitRecordTags/)
  assert.match(src, /item\.tags\?\.length/)
  assert.match(src, /shell-search-hit-tags/)
  const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')
  assert.match(css, /\.shell-search-hit-tags\s*\{[^}]*margin-left:\s*auto/s)
})
