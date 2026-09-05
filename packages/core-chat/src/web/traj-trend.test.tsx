import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { aggregateTurns, compactToSteps, splitTrendData, turnToTrendData } from './usage-panel.tsx'
import type { UsageTrendPoint } from '@biu/web-session-view'

const make = (n: number, start = 100): UsageTrendPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    seq: i + 1,
    turn: 1,
    input: start + i * 10,
    output: 20 + i,
    cache: 0,
  }))

describe('splitTrendData', () => {
  it('splits points into Input and Output datasets under cap', () => {
    const data = splitTrendData(make(3))
    expect(data.input).toEqual([
      { x: 1, value: 100 },
      { x: 2, value: 110 },
      { x: 3, value: 120 },
    ])
    expect(data.output).toEqual([
      { x: 1, value: 20 },
      { x: 2, value: 21 },
      { x: 3, value: 22 },
    ])
    expect(data.cache).toEqual([
      { x: 1, value: 0 },
      { x: 2, value: 0 },
      { x: 3, value: 0 },
    ])
  })

  it('returns empty arrays for no points', () => {
    const data = splitTrendData([])
    expect(data.input).toEqual([])
    expect(data.output).toEqual([])
    expect(data.cache).toEqual([])
  })

  it('keeps all points (no downsampling), including every input/output/cache', () => {
    const data = splitTrendData(make(500))
    expect(data.input).toHaveLength(500)
    expect(data.output).toHaveLength(500)
    expect(data.cache).toHaveLength(500)
    expect(data.input[0].x).toBe(1)
    expect(data.input[0].value).toBe(100)
  })
})

describe('aggregateTurns', () => {
  it('groups steps by turn and counts steps per turn', () => {
    const pts: UsageTrendPoint[] = [
      { seq: 1, turn: 1, input: 100, output: 10, cache: 0 },
      { seq: 2, turn: 1, input: 180, output: 8, cache: 0 },
      { seq: 4, turn: 2, input: 90, output: 5, cache: 0 },
    ]
    const turns = aggregateTurns(pts)
    expect(turns).toHaveLength(2)
    expect(turns[0]).toMatchObject({ turn: 1, steps: 2, input: 280, output: 18, baseInput: 100 })
    expect(turns[1]).toMatchObject({ turn: 2, steps: 1, input: 90, baseInput: 90 })
  })

  it('sorts by turn ascending', () => {
    const turns = aggregateTurns([
      { seq: 9, turn: 3, input: 1, output: 1, cache: 0 },
      { seq: 4, turn: 1, input: 1, output: 1, cache: 0 },
    ])
    expect(turns.map((t) => t.turn)).toEqual([1, 3])
  })
})

describe('compactToSteps', () => {
  it('maps compaction seqs to the next following step index (1-based)', () => {
    const pts: UsageTrendPoint[] = [
      { seq: 10, turn: 1, input: 1, output: 1, cache: 0 },
      { seq: 20, turn: 1, input: 1, output: 1, cache: 0 },
      { seq: 30, turn: 1, input: 1, output: 1, cache: 0 },
    ]
    expect(compactToSteps([15, 30, 999], pts)).toEqual([2, 3])
  })

  it('returns empty for empty compactions', () => {
    expect(compactToSteps([], [{ seq: 1, turn: 1, input: 1, output: 1, cache: 0 }])).toEqual([])
  })
})

describe('turnToTrendData', () => {
  it('splits turn aggregates into Input and Output datasets', () => {
    const turns = aggregateTurns([
      { seq: 1, turn: 1, input: 100, output: 10, cache: 0 },
      { seq: 2, turn: 1, input: 105, output: 6, cache: 0 },
      { seq: 3, turn: 1, input: 110, output: 8, cache: 0 },
      { seq: 5, turn: 2, input: 90, output: 9, cache: 0 },
    ])
    const data = turnToTrendData(turns)
    expect(data.input).toEqual([
      { x: 1, value: 315 },
      { x: 2, value: 90 },
    ])
    expect(data.output).toEqual([
      { x: 1, value: 24 },
      { x: 2, value: 9 },
    ])
    expect(data.cache).toEqual([
      { x: 1, value: 0 },
      { x: 2, value: 0 },
    ])
  })
})

describe('inspector usage panel', () => {
  it('fetches trend by session id when sessionView is omitted', () => {
    const src = readFileSync(resolve(import.meta.dirname, './usage-panel.tsx'), 'utf8')
    expect(src).toContain('async function loadUsageTrend')
    expect(src).toContain('sessionView?.fetchUsageTrend')
    expect(src).toContain('sessionView?: SessionViewService')
  })
})
