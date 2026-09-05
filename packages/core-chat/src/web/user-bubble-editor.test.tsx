import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { UserBubbleEditor } from './user-bubble-editor.tsx'
import { jsonFromDraft } from './composer-tiptap.ts'

describe('UserBubbleEditor', () => {
  it('keeps pick chips inline with surrounding text', async () => {
    const text = '看 <pick kind="task" id="t1" action="open" route="/tasks" label="写需求" /> 吧'
    const json = jsonFromDraft(text)
    expect(JSON.stringify(json)).toContain('pickChip')
    const { container } = render(<UserBubbleEditor text={text} />)
    await waitFor(() => {
      expect(container.textContent).toContain('写需求')
    })
    expect(container.querySelector('[data-testid="user-pick-chip"]')).toBeTruthy()
    const html = container.innerHTML
    expect(html.indexOf('看')).toBeLessThan(html.indexOf('user-pick-chip'))
    expect(html.indexOf('user-pick-chip')).toBeLessThan(html.indexOf('吧'))
  })
})
