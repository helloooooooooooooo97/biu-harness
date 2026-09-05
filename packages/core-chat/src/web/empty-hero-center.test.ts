import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const thread = readFileSync(resolve(import.meta.dirname, './thread.tsx'), 'utf8')

describe('empty chat has no center mascot', () => {
  it('does not paint EmptyHero in the thread', () => {
    expect(thread).not.toMatch(/EmptyHero/)
    expect(thread).not.toMatch(/chat-empty-hero/)
    expect(thread).not.toMatch(/Need a hand/)
    expect(thread).toMatch(/data-testid="chat-empty"/)
  })
})
