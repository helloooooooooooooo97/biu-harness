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
})
