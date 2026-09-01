import { render, waitFor } from '@testing-library/react'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { PageEditor } from './page-editor.tsx'

test('page editor paints markdown headings without a chrome toolbar', async () => {
  const { container, rerender } = render(
    <PageEditor
      record={{ id: 'home' }}
      field="notes"
      spec={{ type: 'file', label: '正文', writable: true }}
      value={'# 欢迎\n\n正文'}
      writable
    />,
  )
  await waitFor(() => {
    assert.ok(container.querySelector('[data-testid="page-editor"]'))
  })
  assert.equal(container.querySelector('h1')?.textContent?.trim(), '欢迎')
  assert.match(container.textContent ?? '', /正文/)
  rerender(
    <PageEditor
      record={{ id: 'home' }}
      field="notes"
      spec={{ type: 'file', label: '正文', writable: true }}
      value={'# 欢迎\n\n正文\n'}
      writable
    />,
  )
  assert.equal(container.querySelector('h1')?.textContent?.trim(), '欢迎')
})
