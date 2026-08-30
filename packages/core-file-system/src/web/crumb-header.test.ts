import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const trail = readFileSync(resolve(import.meta.dirname, './crumb-trail.tsx'), 'utf8')
const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')
const inspector = readFileSync(resolve(import.meta.dirname, './inspector-database.tsx'), 'utf8')

describe('顶栏三级标题', () => {
  it('悬停才露出右侧展开按钮，点标题本身不打开菜单', () => {
    expect(trail).toContain('ChevronDownIcon')
    expect(trail).toContain('data-testid="crumb-expand"')
    expect(trail).toContain('crumbLabelAction')
    expect(trail).toContain("aria-haspopup=\"menu\"")
    expect(trail).toContain('<CrumbItemGlyph kind={crumb.kind}')
    expect(trail).toContain('createPortal')
    expect(trail).toContain('data-fsdb-crumb-menu')
    expect(trail).not.toContain('onMouseEnter')
    expect(browser).toContain('.fsdb-crumb-expand{position:absolute')
    expect(browser).toContain('<CrumbTrail')
  })

  it('中间顶栏面包屑字重和颜色与检查器 tab 对齐', () => {
    expect(browser).toContain('.fsdb-crumb-btn{display:inline-flex')
    expect(browser).toMatch(/\.fsdb-crumb-btn\{[^}]*color:var\(--dsw-sidebar-fg\)/)
    expect(browser).toMatch(/\.fsdb-crumb-btn\{[^}]*font-weight:600/)
    expect(browser).toMatch(/\.fsdb-crumb-option\{[^}]*font-weight:600/)
  })

  it('右侧检查器面包屑同样用展开按钮切换，不靠悬停自动展开', () => {
    expect(inspector).toContain('<CrumbTrail')
    expect(inspector).toContain('onOpenId={setCrumbOpen}')
    expect(inspector).toContain('onActivate={onActivate}')
    expect(inspector).not.toContain('onMouseEnter')
  })

  it('右侧检查器面包屑用记录标题而不是 id', () => {
    expect(inspector).toContain('loadRecords')
    expect(inspector).toContain('recordHit?.label')
    expect(inspector).not.toContain('recordLabel: recordId,')
    expect(browser).toContain('rememberRecords')
    expect(browser).toContain('crumbRecordLabel')
  })
})
