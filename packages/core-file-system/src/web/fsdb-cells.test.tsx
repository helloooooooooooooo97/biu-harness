import { test } from 'vitest'
import assert from 'node:assert/strict'
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
  const img = container.querySelector('img.fsdb-thumb') as HTMLImageElement
  assert.equal(img?.src.endsWith('/page-covers/blue.png'), true)
  assert.equal(img?.getAttribute('width'), '28')
  assert.equal(img?.getAttribute('height'), '18')
})

test('image cells can show more than one thumbnail', () => {
  const { container } = render(
    <DefaultCell field={{ type: 'image' }} value={['/page-covers/blue.png', '/page-covers/red.png']} />,
  )
  assert.equal(container.querySelectorAll('img.fsdb-thumb').length, 2)
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
