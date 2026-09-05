import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('model config dialog stacking', () => {
  it('portals above the inspector and composer dock', () => {
    const src = readFileSync(resolve(import.meta.dirname, './model-config-dialog.tsx'), 'utf8')
    expect(src).toMatch(/createPortal/)
    expect(src).toMatch(/document\.body/)
    expect(src).toMatch(/z-\[240\]/)
    expect(src).not.toMatch(/z-30/)
  })
})
