import { describe, expect, it } from 'vitest'
import { mascotFromSessionId, resolveSessionMascot } from './session-mascot.ts'
import { GROK_COLORS, GROK_SHAPES } from './grok-bot-types.ts'

describe('session mascot persistence helpers', () => {
  it('derives a stable shape+color from session id', () => {
    const a = mascotFromSessionId('sess-a')
    const b = mascotFromSessionId('sess-a')
    expect(a).toEqual(b)
    expect(GROK_SHAPES).toContain(a.shape)
    expect(GROK_COLORS).toContain(a.color)
  })

  it('prefers server-persisted mascot over hash fallback', () => {
    const server = { shape: 'cloud' as const, color: 'orange' as const }
    expect(resolveSessionMascot('sess-a', server)).toEqual(server)
    expect(resolveSessionMascot('sess-a')).toEqual(mascotFromSessionId('sess-a'))
  })
})
