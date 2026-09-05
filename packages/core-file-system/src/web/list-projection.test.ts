import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('table list and previews pass view columns to /api/db/list', () => {
  const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')
  const client = readFileSync(resolve(import.meta.dirname, './db-client.ts'), 'utf8')
  const host = readFileSync(resolve(import.meta.dirname, '../host/index.ts'), 'utf8')
  const preview = readFileSync(resolve(import.meta.dirname, './sidebar-preview.ts'), 'utf8')
  const people = readFileSync(resolve(import.meta.dirname, './person-cell.tsx'), 'utf8')
  const links = readFileSync(resolve(import.meta.dirname, './record-link-cell.tsx'), 'utf8')
  assert.match(browser, /listProjectionKeys/)
  assert.match(browser, /columns: listColumns/)
  assert.match(browser, /\/api\/db\/read\?path=/)
  assert.match(client, /if \(opts\.columns\?\.length\) params\.set\('columns'/)
  assert.match(host, /columns: parseListColumnsParam\(route\.query\.get\('columns'\)\)/)
  assert.match(preview, /columns: \['title', 'emoji', 'mascot'\]/)
  assert.match(people, /columns: \['title', 'mascot'\]/)
  assert.match(links, /columns: \['label'\]/)
})
