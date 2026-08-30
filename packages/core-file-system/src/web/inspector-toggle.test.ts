import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')

test('filesystem header toggles the right inspector, not the left data sidebar', () => {
  assert.match(browser, /data-testid="fsdb-inspector-toggle"/)
  assert.match(browser, /biu:inspector-toggle/)
  assert.match(
    browser,
    /inspectorOpen \?\s*\(\s*<ChevronDoubleRightIcon[\s\S]*:\s*\(\s*<ChevronDoubleLeftIcon/,
  )
  assert.doesNotMatch(browser, /收起左侧边栏/)
  assert.doesNotMatch(browser, /展开左侧边栏/)
})

test('database does not auto-open inspector content; panes follow the current table', () => {
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.doesNotMatch(page, /biu:inspector-open/)
  assert.match(page, /centerKinds: \['collection-view', 'record'\]/)
})
