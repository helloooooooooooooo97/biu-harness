import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, waitFor } from '@testing-library/react'
import { RecordLinkChips } from './record-link-cell.tsx'

test('parent and depend chips show title, not the record id', () => {
  const { container } = render(
    <RecordLinkChips
      field={{ type: 'ref' }}
      fieldKey="parentId"
      value="rec-1"
      records={[{ id: 'rec-1', title: '封面页' }]}
    />,
  )
  const title = container.querySelector('.fsdb-ref-chip-title')
  assert.equal(title?.textContent, '封面页')
  assert.equal(container.textContent?.includes('rec-1'), false)
})

test('depend chips resolve title from the same table when the row is off this page', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    assert.match(url, /\/api\/db\/read/)
    assert.match(url, /n2/)
    return new Response(JSON.stringify({ value: { id: 'n2', title: '依赖页' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
  try {
    const { container } = render(
      <RecordLinkChips
        field={{ type: 'multi-ref' }}
        fieldKey="dependsOn"
        value={['n2']}
        collectionPath="/notes"
        records={[{ id: 'n1', title: '当前' }]}
      />,
    )
    await waitFor(() => {
      assert.equal(container.querySelector('.fsdb-ref-chip-title')?.textContent, '依赖页')
    })
    assert.equal(container.textContent?.includes('n2'), false)
  } finally {
    globalThis.fetch = original
  }
})

test('ref picker lists titles and does not print ids beside them', () => {
  const src = readFileSync(resolve(import.meta.dirname, './record-link-cell.tsx'), 'utf8')
  assert.match(src, /crumbRecordLabel/)
  assert.match(src, /\/api\/db\/read/)
  assert.doesNotMatch(src, /fsdb-ref-id/)
  assert.doesNotMatch(src, /id\.slice\(0, 8\)/)
})
