import { render, waitFor } from '@testing-library/react'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import { PageEditor } from './page-editor.tsx'
import { PageEditorService } from './service.ts'

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

test('page editor uses plugin heading views when pageEditor has replacements', async () => {
  const ctx = new Context()
  new PageEditorService(ctx)
  ctx.pageEditor.replaceHeading(1, {
    View: ({ children }) => <span data-testid="h1-plugin">{children}</span>,
  })
  const { container } = render(
    <PageEditor
      record={{ id: 'home' }}
      field="notes"
      spec={{ type: 'file', label: '正文', writable: true }}
      value={'# 欢迎'}
      writable
    />,
  )
  await waitFor(() => {
    assert.ok(container.querySelector('h1.page-heading [data-testid="h1-plugin"]'))
  })
  const heading = container.querySelector('h1.page-heading')
  assert.equal(heading?.textContent?.trim(), '欢迎')
  assert.equal(heading?.querySelector('[data-node-view-content]')?.tagName, 'SPAN')
})
