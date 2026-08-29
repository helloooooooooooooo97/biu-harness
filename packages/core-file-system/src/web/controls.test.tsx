import { test } from 'vitest'
import assert from 'node:assert/strict'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { AppDialog } from './controls.tsx'

test('named AppDialog keeps draft local so the parent does not re-render while typing', () => {
  let parentRenders = 0
  let confirmed = ''
  function Host() {
    parentRenders += 1
    const [error, setError] = useState('')
    return (
      <AppDialog
        title="重命名视图"
        confirm="保存"
        onCancel={() => {}}
        onConfirm={(name) => {
          confirmed = name ?? ''
        }}
        input={{ defaultValue: '列表', placeholder: '视图名称', maxLength: 80 }}
        error={error}
        onClearError={() => setError('')}
      />
    )
  }
  render(<Host />)
  const input = screen.getByPlaceholderText('视图名称') as HTMLInputElement
  assert.equal(input.value, '列表')
  assert.equal(input.maxLength, 80)
  const before = parentRenders
  fireEvent.change(input, { target: { value: '列表改名' } })
  assert.equal(input.value, '列表改名')
  assert.equal(parentRenders, before)
  assert.equal(confirmed, '')
  fireEvent.click(screen.getByRole('button', { name: '保存' }))
  assert.equal(confirmed, '列表改名')
})
