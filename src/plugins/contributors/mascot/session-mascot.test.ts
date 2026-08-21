import { afterEach, describe, expect, it } from 'vitest'
import {
  assignSessionMascot,
  getOrAssignSessionMascot,
  peekSessionMascot,
  releaseSessionMascot,
} from './session-mascot.ts'
import { GROK_COLORS, GROK_SHAPES } from './grok-bot-types.ts'

const KEY = 'dsh.session-mascots.v1'

afterEach(() => {
  localStorage.removeItem(KEY)
})

describe('session mascot assignment', () => {
  it('assigns a stable shape+color per session id', () => {
    const a = assignSessionMascot('sess-a')
    expect(GROK_SHAPES).toContain(a.shape)
    expect(GROK_COLORS).toContain(a.color)
    expect(getOrAssignSessionMascot('sess-a')).toEqual(a)
    expect(peekSessionMascot('sess-a')).toEqual(a)
  })

  it('prefers unused combos across chats', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 20; i += 1) {
      const id = `sess-${i}`
      const m = assignSessionMascot(id)
      const key = `${m.shape}:${m.color}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('releases identity on delete', () => {
    assignSessionMascot('gone')
    releaseSessionMascot('gone')
    expect(peekSessionMascot('gone')).toBeNull()
  })
})
