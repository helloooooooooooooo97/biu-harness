import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const shell = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')

describe('panel collapse chevrons follow panel state', () => {
  it('points left to open the inspector and right to collapse it', () => {
    expect(shell).toMatch(
      /inspectorOpen \?\s*\(\s*<ChevronDoubleRightIcon[\s\S]*:\s*\(\s*<ChevronDoubleLeftIcon/,
    )
  })

  it('opens the inspector rail even when no tab is selected yet', () => {
    expect(shell).toMatch(/const inspectorVisible = inspectorOpen/)
    expect(shell).not.toMatch(/inspectorVisible = inspectorOpen && inspectorTabCount/)
  })

  it('declares inspector persist helpers once (no duplicate onOpen)', () => {
    const persistBlock = shell.match(
      /const persist = \(next: boolean\) => \{[\s\S]*?window\.addEventListener\('biu:inspector-toggle', onToggle\)/,
    )
    expect(persistBlock?.[0]).toBeTruthy()
    expect(persistBlock?.[0].match(/const onOpen =/g)?.length).toBe(1)
    expect(persistBlock?.[0]).toContain('const persist = (next: boolean)')
    expect(persistBlock?.[0]).toContain('const onClose = () => persist(false)')
  })
})
