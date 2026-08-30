import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const trail = readFileSync(resolve(import.meta.dirname, './crumb-trail.tsx'), 'utf8')
const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')
const style = readFileSync(resolve(import.meta.dirname, './fsdb-style.ts'), 'utf8')

describe('顶栏三级标题', () => {
  it('中间顶栏点标题出菜单', () => {
    expect(trail).toContain("aria-haspopup={canPick ? 'menu' : undefined}")
    expect(trail).toContain('allowMenu')
    expect(trail).toContain('icon={crumb.icon ?? current?.icon}')
    expect(trail).toContain('tableCrumb?.icon')
    expect(browser).toContain("target.kind === 'view' && target.collection === collectionPath")
    expect(browser).toContain('<CrumbTrail')
    const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
    expect(page).toMatch(/onOpenView=\{\(viewId\) => go\(\{ collection: currentPath, viewId \}\)/)
    expect(trail).toContain('createPortal')
    expect(trail).toContain('data-fsdb-crumb-menu')
    expect(trail).toContain('fsdb-crumb-search')
    expect(trail).toContain('添加视图')
    expect(trail).toContain('新建记录')
    expect(trail).toContain('onCreate')
    expect(trail).not.toContain('data-testid="crumb-expand"')
    expect(style).not.toContain('.fsdb-crumb-expand{position:absolute')
    expect(browser).toContain('<CrumbTrail')
  })

  it('中间顶栏面包屑字重和颜色与侧栏标题对齐', () => {
    expect(style).toContain('.fsdb-crumb-btn{display:inline-flex')
    expect(style).toMatch(/\.fsdb-crumb-btn\{[^}]*color:var\(--dsw-sidebar-fg\)/)
    expect(style).toMatch(/\.fsdb-crumb-btn\{[^}]*font-weight:600/)
    expect(style).toMatch(/\.fsdb-crumb-option\{[^}]*font-weight:600/)
  })

  it('改视图名会先写入缓存再通知面包屑', () => {
    expect(browser).toMatch(/rememberViews\(collectionPath, next\)[\s\S]*localStorage\.setItem\(viewsKey\(collectionPath\)[\s\S]*fsdb:change/)
    expect(browser).toContain("window.dispatchEvent(new Event('fsdb:crumb-labels'))")
    expect(browser).toContain('rememberRecords')
    expect(browser).toContain('crumbRecordLabel')
  })
})
