import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')

describe('顶栏三级标题', () => {
  it('没有单独的下拉箭头，点标题本身出菜单', () => {
    const nav = browser.match(/aria-label="位置"[\s\S]*?<\/nav>/)?.[0]
    expect(nav).toBeTruthy()
    expect(nav).not.toContain('ChevronDownIcon')
    expect(nav).toContain('aria-haspopup={canPick ? \'menu\' : undefined}')
    expect(nav).toContain('<CrumbGlyph kind={choice.target.kind} />')
  })
})
