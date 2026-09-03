import { test } from 'vitest'
import assert from 'node:assert/strict'
import { SEARCH_SCOPES, searchHref } from './shell-search.tsx'

test('search hrefs stay on session chat or database records', () => {
  assert.equal(searchHref('session', 'abc'), '/s/abc')
  assert.equal(searchHref('task', 't1'), '/database/tasks/record/t1')
  assert.equal(searchHref('page', 'p1'), '/database/pages/record/p1')
  assert.equal(searchHref('plugin', 'x'), '/database/plugins/record/x')
  assert.equal(searchHref('facet', 'f'), '/database/facets/record/f')
  assert.deepEqual(
    SEARCH_SCOPES.map((item) => item.label),
    ['会话', '任务', '页面', '插件', '类型'],
  )
})
