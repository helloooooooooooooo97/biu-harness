import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const trail = readFileSync(resolve(import.meta.dirname, './crumb-trail.tsx'), 'utf8')
const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')
const inspector = readFileSync(resolve(import.meta.dirname, './inspector-database.tsx'), 'utf8')
const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')

describe('顶栏三级标题', () => {
  it('中间顶栏点标题出菜单；检查器不靠悬停把面包屑撑开', () => {
    expect(trail).toContain("aria-haspopup={canPick ? 'menu' : undefined}")
    expect(trail).toContain('allowMenu')
    expect(trail).toContain('<CrumbItemGlyph kind={crumb.kind}')
    expect(trail).toContain('createPortal')
    expect(trail).toContain('data-fsdb-crumb-menu')
    expect(trail).not.toContain('data-testid="crumb-expand"')
    expect(browser).not.toContain('.fsdb-crumb-expand{position:absolute')
    expect(browser).toContain('<CrumbTrail')
  })

  it('中间顶栏面包屑字重和颜色与检查器 tab 对齐', () => {
    expect(browser).toContain('.fsdb-crumb-btn{display:inline-flex')
    expect(browser).toMatch(/\.fsdb-crumb-btn\{[^}]*color:var\(--dsw-sidebar-fg\)/)
    expect(browser).toMatch(/\.fsdb-crumb-btn\{[^}]*font-weight:600/)
    expect(browser).toMatch(/\.fsdb-crumb-option\{[^}]*font-weight:600/)
  })

  it('右侧检查器用一个展开按钮控制整条面包屑，悬停不自动变成多项', () => {
    expect(inspector).toContain('data-testid="inspector-crumb-toggle"')
    expect(inspector).toContain('ChevronRightIcon')
    expect(inspector).toContain('ChevronLeftIcon')
    expect(inspector).not.toContain('ChevronDownIcon')
    expect(inspector).toContain('allowMenu={trailOpen}')
    expect(css).toMatch(/\.inspector-crumb-toggle\s*\{[^}]*background:\s*transparent/s)
    expect(css).toMatch(/\.inspector-crumb-toggle\s*\{[^}]*box-shadow:\s*none/s)
    expect(css).not.toContain('inspector-crumb-toggle.is-open {\n  transform: translateY(-50%) rotate(180deg);')
    expect(inspector).not.toContain('onMouseEnter')
    expect(css).toContain('.inspector-crumb-tab.is-crumb-open .inspector-crumb-full .fsdb-crumb:not(:last-child)')
    expect(css).not.toContain('.inspector-crumb-tab:hover .inspector-crumb-full .fsdb-crumb:not(:last-child)')
    expect(trail).toContain("!allowMenu && crumb.kind === 'view'")
    expect(trail).toContain('<TableGlyph icon={tableIcon} />')
  })

  it('右侧检查器面包屑用记录标题而不是 id', () => {
    expect(inspector).toContain('loadRecords')
    expect(inspector).toContain('recordHit?.label')
    expect(inspector).not.toContain('recordLabel: recordId,')
    expect(browser).toContain('rememberRecords')
    expect(browser).toContain('crumbRecordLabel')
  })
})
