import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const inspector = readFileSync(resolve(import.meta.dirname, './session-inspector.tsx'), 'utf8')

describe('inspector session-only tabs', () => {
  it('hides requiresSession tabs when no session is selected', () => {
    expect(inspector).toContain('requiresSession: Boolean(extra.requiresSession)')
    expect(inspector).toMatch(/sessionId \? tabs : tabs\.filter\(\(item\) => !item\.requiresSession\)/)
  })
})
