import { useLayoutEffect, useRef, useState, type MouseEvent, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { CrumbItemGlyph } from './nav-glyphs.tsx'
import { crumbButtonAction, type Crumb, type CrumbTarget } from './sidebar-nav.ts'

export function CrumbTrail({
  crumbs,
  openId,
  onOpenId,
  onPick,
  onActivate,
  navRef,
  className,
  label,
  allowMenu = true,
}: {
  crumbs: Crumb[]
  openId: string | null
  onOpenId: (id: string | null) => void
  onPick: (target: CrumbTarget) => void
  onActivate?: () => void
  navRef?: Ref<HTMLElement | null>
  className?: string
  label?: string
  /** 收起时只激活面板，不弹出某一级的选择菜单 */
  allowMenu?: boolean
}) {
  const btnRefs = useRef(new Map<string, HTMLButtonElement>())
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null)
  const openCrumb = crumbs.find((item) => item.id === openId)

  useLayoutEffect(() => {
    if (!openId) {
      setMenuPos(null)
      return
    }
    const box = btnRefs.current.get(openId)?.getBoundingClientRect()
    if (!box) return
    setMenuPos({ left: Math.max(8, box.left), top: box.bottom + 4 })
  }, [openId, crumbs])

  return (
    <nav className={className ?? 'fsdb-crumbs'} aria-label={label ?? '位置'} ref={navRef}>
      {crumbs.map((crumb, index) => {
        const canPick = allowMenu && crumb.choices.length > 1
        const open = openId === crumb.id
        const current = crumb.choices.find((item) => item.id === crumb.id)
        return (
          <span key={crumb.id} className="fsdb-crumb">
            {index ? <span className="fsdb-crumb-sep" aria-hidden>/</span> : null}
            <span className="fsdb-crumb-pick">
              <button
                type="button"
                ref={(el) => {
                  if (el) btnRefs.current.set(crumb.id, el)
                  else btnRefs.current.delete(crumb.id)
                }}
                className={`fsdb-crumb-btn${open ? ' is-open' : ''}`}
                title={crumb.label}
                aria-haspopup={canPick ? 'menu' : undefined}
                aria-expanded={canPick ? open : undefined}
                onClick={(event: MouseEvent) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onActivate?.()
                  if (!allowMenu) {
                    onOpenId(null)
                    return
                  }
                  const action = crumbButtonAction(crumb, index ? crumbs[index - 1] : undefined)
                  if (action === 'menu') {
                    onOpenId(open ? null : crumb.id)
                    return
                  }
                  onPick(action)
                  onOpenId(null)
                }}
              >
                <CrumbItemGlyph kind={crumb.kind} icon={current?.icon} mode={current?.mode} emoji={current?.emoji} />
                <span className="chat-view-project-name">{crumb.label}</span>
              </button>
            </span>
          </span>
        )
      })}
      {allowMenu && openCrumb && openCrumb.choices.length > 1 && menuPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fsdb-crumb-menu is-fixed"
              role="menu"
              data-fsdb-crumb-menu=""
              style={{ left: menuPos.left, top: menuPos.top }}
            >
              {openCrumb.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={`fsdb-crumb-option${choice.id === openCrumb.id ? ' is-active' : ''}`}
                  role="menuitem"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onPick(choice.target)
                    onOpenId(null)
                  }}
                >
                  <CrumbItemGlyph kind={openCrumb.kind} icon={choice.icon} mode={choice.mode} emoji={choice.emoji} />
                  <span className="chat-view-project-name">{choice.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </nav>
  )
}
