import { type MouseEvent, type Ref } from 'react'
import { CrumbItemGlyph } from './nav-glyphs.tsx'
import type { Crumb, CrumbTarget } from './sidebar-nav.ts'

export function CrumbTrail({
  crumbs,
  openId,
  onOpenId,
  onPick,
  navRef,
  className,
  label,
}: {
  crumbs: Crumb[]
  openId: string | null
  onOpenId: (id: string | null) => void
  onPick: (target: CrumbTarget) => void
  navRef?: Ref<HTMLElement | null>
  className?: string
  label?: string
}) {
  return (
    <nav className={className ?? 'fsdb-crumbs'} aria-label={label ?? '位置'} ref={navRef}>
      {crumbs.map((crumb, index) => {
        const canPick = crumb.choices.length > 1
        const open = openId === crumb.id
        const current = crumb.choices.find((item) => item.id === crumb.id)
        return (
          <span key={crumb.id} className="fsdb-crumb">
            {index ? <span className="fsdb-crumb-sep" aria-hidden>/</span> : null}
            <span className="fsdb-crumb-pick">
              <button
                type="button"
                className={`fsdb-crumb-btn${open ? ' is-open' : ''}`}
                title={crumb.label}
                aria-haspopup={canPick ? 'menu' : undefined}
                aria-expanded={canPick ? open : undefined}
                onClick={(event: MouseEvent) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (canPick) {
                    onOpenId(open ? null : crumb.id)
                    return
                  }
                  onPick(crumb.target)
                  onOpenId(null)
                }}
              >
                <CrumbItemGlyph kind={crumb.kind} icon={current?.icon} mode={current?.mode} emoji={current?.emoji} />
                <span className="chat-view-project-name">{crumb.label}</span>
              </button>
              {canPick && open ? (
                <div className="fsdb-crumb-menu" role="menu">
                  {crumb.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      className={`fsdb-crumb-option${choice.id === crumb.id ? ' is-active' : ''}`}
                      role="menuitem"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onPick(choice.target)
                        onOpenId(null)
                      }}
                    >
                      <CrumbItemGlyph kind={crumb.kind} icon={choice.icon} mode={choice.mode} emoji={choice.emoji} />
                      <span className="chat-view-project-name">{choice.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </span>
          </span>
        )
      })}
    </nav>
  )
}
