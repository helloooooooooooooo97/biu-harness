import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/react'
import { DefaultCell } from './fsdb-cells.tsx'

test('attachment cells render a file link, not a broken image', () => {
  const { container } = render(
    <DefaultCell field={{ type: 'attachment' }} value={{ name: 'notes.pdf', href: 'https://cdn.example/notes.pdf' }} />,
  )
  assert.equal(container.querySelector('img'), null)
  const link = container.querySelector('a.fsdb-file') as HTMLAnchorElement
  assert.equal(link?.textContent?.includes('notes.pdf'), true)
  assert.equal(link?.href, 'https://cdn.example/notes.pdf')
})

test('image cells still render a thumbnail', () => {
  const { container } = render(<DefaultCell field={{ type: 'image' }} value="/page-covers/blue.png" />)
  const img = container.querySelector('img') as HTMLImageElement
  assert.equal(Boolean(img?.src.endsWith('/page-covers/blue.png')), true)
  assert.equal(img?.getAttribute('width'), '28')
  assert.equal(img?.getAttribute('height'), '18')
})

test('image cells can show more than one thumbnail', () => {
  const { container } = render(
    <DefaultCell field={{ type: 'image' }} value={['/page-covers/blue.png', '/page-covers/red.png']} />,
  )
  assert.equal(container.querySelectorAll('img').length, 2)
})

test('empty cells render no placeholder copy', () => {
  const text = render(<DefaultCell field={{ type: 'string' }} value="" />)
  assert.equal(text.container.textContent, '')
  const select = render(<DefaultCell field={{ type: 'select' }} value="" />)
  assert.equal(select.container.textContent, '')
  const file = render(<DefaultCell field={{ type: 'attachment' }} value="" />)
  assert.equal(file.container.textContent, '')
  const number = render(<DefaultCell field={{ type: 'number' }} value={0} />)
  assert.equal(number.container.textContent, '')
  const href = render(<DefaultCell field={{ type: 'url' }} value="" />)
  assert.equal(href.container.textContent, '')
  const emptyFile = render(<DefaultCell field={{ type: 'attachment' }} value={{}} />)
  assert.equal(emptyFile.container.textContent, '')
})

test('image zoom uses antd Image preview', () => {
  const cells = readFileSync(resolve(import.meta.dirname, './fsdb-cells.tsx'), 'utf8')
  const media = readFileSync(resolve(import.meta.dirname, './cell-media.tsx'), 'utf8')
  const thumbs = readFileSync(resolve(import.meta.dirname, '../../../cap-chat/src/web/image-thumbs.tsx'), 'utf8')
  const tools = readFileSync(resolve(import.meta.dirname, '../../../cap-chat/src/web/tool-card.tsx'), 'utf8')
  assert.match(cells, /from 'antd'/)
  assert.match(cells, /Image\.PreviewGroup/)
  assert.doesNotMatch(cells, /fsdb-lightbox/)
  assert.match(media, /from 'antd'/)
  assert.match(media, /Image\.PreviewGroup/)
  assert.match(thumbs, /from 'antd'/)
  assert.match(thumbs, /Image\.PreviewGroup/)
  assert.doesNotMatch(thumbs, /composer-image-lightbox/)
  assert.match(tools, /Image\.PreviewGroup/)
})
