import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const pager = readFileSync(resolve(import.meta.dirname, './pager-size.tsx'), 'utf8')
const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')

test('page-size menu is a local control, not CollectionBrowser state', () => {
  assert.match(browser, /<PagerSizeControl/)
  assert.match(browser, /onChange=\{setPageSize\}/)
  assert.doesNotMatch(browser, /pageSizeOpen/)
  assert.doesNotMatch(browser, /toggleMenu\('pageSize'\)/)
  assert.doesNotMatch(browser, /pageSizeMenuPos/)
  assert.match(pager, /HeadlessPopover/)
  assert.match(pager, /if \(next !== pageSize\) onChange\(next\)/)
})
