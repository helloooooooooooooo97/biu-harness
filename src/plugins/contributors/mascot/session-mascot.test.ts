import { describe, expect, it } from 'vitest'
import { mascotFromSessionId, resolveSessionMascot } from './session-mascot.ts'
import { GROK_COLORS, GROK_REST_EYES, GROK_SHAPES } from './grok-bot-types.ts'

describe('session mascot persistence helpers', () => {
  it('derives a stable shape+color+eye from session id', () => {
    const a = mascotFromSessionId('sess-a')
    const b = mascotFromSessionId('sess-a')
    expect(a).toEqual(b)
    expect(GROK_SHAPES).toContain(a.shape)
    expect(GROK_COLORS).toContain(a.color)
    expect(GROK_REST_EYES).toContain(a.eye)
  })

  it('gives different resting eyes across ids', () => {
    const eyes = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => mascotFromSessionId(id).eye),
    )
    expect(eyes.size).toBeGreaterThan(1)
  })

  it('prefers server-persisted mascot over hash fallback', () => {
    const server = { shape: 'cloud' as const, color: 'orange' as const, eye: 7 }
    expect(resolveSessionMascot('sess-a', server)).toEqual(server)
    expect(resolveSessionMascot('sess-a')).toEqual(mascotFromSessionId('sess-a'))
  })

  it('fills missing eye from session id for legacy shape+color', () => {
    const legacy = { shape: 'cloud' as const, color: 'orange' as const }
    const resolved = resolveSessionMascot('sess-a', legacy)
    expect(resolved.shape).toBe('cloud')
    expect(resolved.color).toBe('orange')
    expect(typeof resolved.eye).toBe('number')
  })
})
