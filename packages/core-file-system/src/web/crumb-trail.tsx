import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/16/solid'
import { CrumbItemGlyph, TableGlyph } from './nav-glyphs.tsx'
import { crumbButtonAction, type Crumb, type CrumbTarget } from './sidebar-nav.ts'

function canOpenCrumbMenu(crumb: Crumb) {
  return crumb.kind === 'collection' || crumb.kind === 'view' || crumb.kind === 'record'
}

function createKindOf(crumb: Crumb): 'view' | 'record' | null {
  if (crumb.kind === 'record') return 'record'
  if (crumb.kind === 'collection' || crumb.kind === 'view') return 'view'
  return null
}

function CrumbMenu({
  crumb,
  crumbs,
  pos,
  onPick,
  onOpenId,
  onCreate,
  canCreateView,
  canCreateRecord,
}: {
  crumb: Crumb
  crumbs: Crumb[]
  pos: { left: number; top: number }
  onPick: (target: CrumbTarget) => void
  onOpenId: (id: string | null) => void
  onCreate?: (kind: 'view' | 'record') => void
  canCreateView?: boolean
  canCreateRecord?: boolean
}) {
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => crumb.choices.filter((item) => !q || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)),
    [crumb.choices, q],
  )
  const createKind = createKindOf(crumb)
  const showCreate =
    (createKind === 'view' && canCreateView && onCreate) || (createKind === 'record' && canCreateRecord && onCreate)

  useEffect(() => {
    const id = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div
      className="fsdb-crumb-menu is-fixed"
      role="menu"
      data-fsdb-crumb-menu=""
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <label className="fsdb-crumb-search">
        <MagnifyingGlassIcon aria-hidden className="size-[14px]" />
        <input
          ref={searchRef}
          value={query}
          placeholder="搜索"
          aria-label="搜索"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onOpenId(null)
              return
            }
            if (event.key !== 'Enter' || !filtered[0]) return
            event.preventDefault()
            onPick(filtered[0].target)
            onOpenId(null)
          }}
        />
      </label>
      <div className="fsdb-crumb-menu-list">
        {filtered.length === 0 ? <div className="fsdb-crumb-empty">没有匹配项</div> : null}
        {filtered.map((choice) => {
          const viewId = crumbs.find((item) => item.kind === 'view')?.id
          const active =
            choice.target.kind === 'view' ? choice.target.viewId === viewId : choice.id === crumb.id
          const glyphKind = choice.target.kind === 'view' ? 'view' : crumb.kind
          return (
            <button
              key={choice.id}
              type="button"
              className={`fsdb-crumb-option${active ? ' is-active' : ''}`}
              role="menuitem"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onPick(choice.target)
                onOpenId(null)
              }}
            >
              <CrumbItemGlyph kind={glyphKind} icon={choice.icon} mode={choice.mode} emoji={choice.emoji} />
              <span className="chat-view-project-name">{choice.label}</span>
            </button>
          )
        })}
      </div>
      {showCreate && createKind ? (
        <div className="fsdb-crumb-menu-foot">
          <button
            type="button"
            className="fsdb-crumb-create"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onCreate?.(createKind)
              onOpenId(null)
            }}
          >
            <PlusIcon aria-hidden className="size-[14px]" />
            {createKind === 'record' ? '新建记录' : '添加视图'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function CrumbTrail({
  crumbs,
  openId,
  onOpenId,
  onPick,
  onActivate,
  onCreate,
  canCreateView = false,
  canCreateRecord = false,
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
  onCreate?: (kind: 'view' | 'record') => void
  canCreateView?: boolean
  canCreateRecord?: boolean
  navRef?: Ref<HTMLElement | null>
  className?: string
  label?: string
  /** 收起时只激活面板，不弹出某一级的选择菜单 */
  allowMenu?: boolean
}) {
  const btnRefs = useRef(new Map<string, HTMLButtonElement>())
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null)
  const openCrumb = crumbs.find((item) => item.id === openId)
  const tableCrumb = crumbs.find((item) => item.kind === 'collection')
  const tableIcon = tableCrumb?.icon

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
        const canPick = allowMenu && canOpenCrumbMenu(crumb)
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
                {!allowMenu && crumb.kind === 'view' ? <TableGlyph icon={tableIcon} /> : null}
                <CrumbItemGlyph kind={crumb.kind} icon={crumb.icon ?? current?.icon} mode={current?.mode} emoji={current?.emoji} />
                <span className="chat-view-project-name">{crumb.label}</span>
              </button>
            </span>
          </span>
        )
      })}
      {allowMenu && openCrumb && canOpenCrumbMenu(openCrumb) && menuPos && typeof document !== 'undefined'
        ? createPortal(
            <CrumbMenu
              key={openCrumb.id}
              crumb={openCrumb}
              crumbs={crumbs}
              pos={menuPos}
              onPick={onPick}
              onOpenId={onOpenId}
              onCreate={onCreate}
              canCreateView={canCreateView}
              canCreateRecord={canCreateRecord}
            />,
            document.body,
          )
        : null}
    </nav>
  )
}