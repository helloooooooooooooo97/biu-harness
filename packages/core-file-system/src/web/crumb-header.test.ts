import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const trail = readFileSync(resolve(import.meta.dirname, './crumb-trail.tsx'), 'utf8')
const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')
const inspector = readFileSync(resolve(import.meta.dirname, './inspector-database.tsx'), 'utf8')

describe('顶栏三级标题', () => {
  it('没有单独的下拉箭头，点标题本身出菜单', () => {
    expect(trail).not.toContain('ChevronDownIcon')
    expect(trail).toContain("aria-haspopup={canPick ? 'menu' : undefined}")
    expect(trail).toContain('<CrumbItemGlyph kind={crumb.kind}')
    expect(trail).toContain('createPortal')
    expect(trail).toContain('data-fsdb-crumb-menu')
    expect(trail).toContain('<CrumbItemGlyph kind={openCrumb.kind} icon={choice.icon} mode={choice.mode} emoji={choice.emoji} />')
    expect(browser).toContain('<CrumbTrail')
  })

  it('中间顶栏面包屑字重和颜色与检查器 tab 对齐', () => {
    expect(browser).toContain('.fsdb-crumb-btn{display:inline-flex')
    expect(browser).toMatch(/\.fsdb-crumb-btn\{[^}]*color:var\(--dsw-sidebar-fg\)/)
    expect(browser).toMatch(/\.fsdb-crumb-btn\{[^}]*font-weight:600/)
    expect(browser).toMatch(/\.fsdb-crumb-option\{[^}]*font-weight:600/)
  })

  it('右侧检查器面包屑同样用下拉切换，不靠点回去退', () => {
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
