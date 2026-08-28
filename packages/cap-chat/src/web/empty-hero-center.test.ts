import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')

describe('empty chat hero centering', () => {
  it('fills the stage including composer reserve so the mascot is not shifted up', () => {
    expect(css).toMatch(/\.chat-empty-hero[\s\S]*min-height:\s*calc\(100% \+ 11rem\)/)
    expect(css).toMatch(/\.chat-empty-hero[\s\S]*margin-bottom:\s*-11rem/)
    expect(css).toMatch(/\.chat-empty-hero[\s\S]*padding:\s*0/)
  })
})
