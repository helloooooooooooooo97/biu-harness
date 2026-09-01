import { createRef } from 'react'
import { act, render } from '@testing-library/react'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { PAGE_EDITOR_STYLE } from './style.ts'
import { SlashList } from './slash-list.tsx'
import { SLASH_ITEMS } from './slash.ts'

test('slash list scrolls the active row into view', () => {
  const style = document.createElement('style')
  style.textContent = PAGE_EDITOR_STYLE
  document.head.appendChild(style)
  const ref = createRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }>()
  const { container } = render(<SlashList ref={ref} items={SLASH_ITEMS} command={() => undefined} />)
  const list = container.querySelector('.page-slash') as HTMLDivElement
  const last = container.querySelectorAll('.page-slash-item')[SLASH_ITEMS.length - 1] as HTMLButtonElement
  let scrolled = false
  last.scrollIntoView = () => {
    scrolled = true
  }
  act(() => {
    for (let i = 0; i < SLASH_ITEMS.length - 1; i += 1) {
      ref.current?.onKeyDown({ event: new KeyboardEvent('keydown', { key: 'ArrowDown' }) })
    }
  })
  assert.equal(getComputedStyle(list).overflowY, 'auto')
  assert.equal(scrolled, true)
  style.remove()
})
