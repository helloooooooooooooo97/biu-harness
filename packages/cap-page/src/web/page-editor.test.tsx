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

test('heading plugin skins native h1 and does not install a node view', async () => {
  const ctx = new Context()
  new PageEditorService(ctx)
  ctx.pageEditor.replaceHeading(1, { label: 'H1', className: 'page-heading-card' })
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
    assert.ok(container.querySelector('h1[data-heading-plugin="1"]'))
  })
  const heading = container.querySelector('h1[data-heading-plugin="1"]')
  assert.equal(heading?.textContent?.trim(), '欢迎')
  assert.equal(heading?.classList.contains('page-heading-card'), true)
  assert.equal(container.querySelector('[data-node-view-wrapper]'), null)
})
