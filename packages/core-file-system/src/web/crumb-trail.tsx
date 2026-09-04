import { useEffect, useMemo, useRef, useState, type MouseEvent, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/16/solid'
import { listenOutsideDismiss } from '@biu/public-ui'
import { CrumbItemGlyph, TableGlyph } from './nav-glyphs.tsx'
import { crumbButtonAction, type Crumb, type CrumbTarget } from './sidebar-nav.ts'

function canOpenCrumbMenu(crumb: Crumb) {
  return crumb.kind === 'collection' || crumb.kind === 'view' || crumb.kind === 'record'
}

function createKindOf(crumb: Crumb): 'view' | 'record' | null {
  if (crumb.kind === 'record') return 'record'
  if (crumb.kind === 'view') return 'view'
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
            choice.target.kind === 'view'
              ? choice.target.viewId === viewId
              : choice.target.kind === 'collection'
                ? choice.target.collection === crumb.id
                : choice.id === crumb.id
          const glyphKind =
            choice.target.kind === 'view' ? 'view' : choice.target.kind === 'collection' ? 'collection' : crumb.kind
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
              <CrumbItemGlyph
                kind={glyphKind}
                icon={choice.icon}
                mode={choice.mode}
                emoji={choice.emoji}
                mascot={choice.mascot}
                collection={choice.target.kind === 'record' ? choice.target.collection : undefined}
                recordId={choice.target.kind === 'record' ? choice.target.recordId : undefined}
              />
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
  onPick,
  onActivate,
  onCreate,
  canCreateView = false,
  canCreateRecord = false,
  navRef,
  className,
  label,
  allowMenu = true,
  lockRootCrumb = false,
}: {
  crumbs: Crumb[]
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
  /** 右侧检查器：一级只显示图标且不可点选，从第二级开始切换 */
  lockRootCrumb?: boolean
}) {
  const trailRef = useRef<HTMLElement | null>(null)
  const [openMenu, setOpenMenu] = useState<{ id: string; left: number; top: number } | null>(null)
  const openId = openMenu?.id ?? null
  const menuPos = openMenu ? { left: openMenu.left, top: openMenu.top } : null
  const openCrumb = crumbs.find((item) => item.id === openId)
  const tableCrumb = crumbs.find((item) => item.kind === 'collection')
  const tableIcon = tableCrumb?.icon

  useEffect(() => {
    if (!allowMenu) setOpenMenu(null)
  }, [allowMenu])

  useEffect(() => {
    return listenOutsideDismiss(
      () => setOpenMenu(null),
      (target) =>
        Boolean(
          trailRef.current?.contains(target) ||
            (target instanceof Element && target.closest('[data-fsdb-crumb-menu]')),
        ),
    )
  }, [])

  return (
    <nav
      className={className ?? 'fsdb-crumbs'}
      aria-label={label ?? '位置'}
      ref={(node) => {
        trailRef.current = node
        if (typeof navRef === 'function') navRef(node)
        else if (navRef) navRef.current = node
      }}
    >
      {crumbs.map((crumb, index) => {
        const rootLocked = lockRootCrumb && index === 0 && crumbs.length > 1
        const canPick = allowMenu && !rootLocked && canOpenCrumbMenu(crumb)
        const open = openId === crumb.id
        const current = crumb.choices.find((item) => item.id === crumb.id)
        const glyph = (
          <>
            {!allowMenu && crumb.kind === 'view' ? <TableGlyph icon={tableIcon} /> : null}
            <CrumbItemGlyph
              kind={crumb.kind}
              icon={crumb.icon ?? current?.icon}
              mode={current?.mode}
              emoji={current?.emoji ?? crumb.emoji}
              mascot={current?.mascot ?? crumb.mascot}
              collection={crumb.kind === 'record' && crumb.target.kind === 'record' ? crumb.target.collection : undefined}
              recordId={crumb.kind === 'record' && crumb.target.kind === 'record' ? crumb.target.recordId : undefined}
            />
            {rootLocked ? null : <span className="chat-view-project-name">{crumb.label}</span>}
          </>
        )
        return (
          <span key={crumb.id} className="fsdb-crumb">
            {index && !(lockRootCrumb && index === 1) ? <span className="fsdb-crumb-sep" aria-hidden>/</span> : null}
            <span className="fsdb-crumb-pick">
              {rootLocked ? (
                <span className="fsdb-crumb-btn is-static" title={crumb.label} aria-label={crumb.label}>
                  {glyph}
                </span>
              ) : (
              <button
                type="button"
                className={`fsdb-crumb-btn${open ? ' is-open' : ''}`}
                title={crumb.label}
                aria-haspopup={canPick ? 'menu' : undefined}
                aria-expanded={canPick ? open : undefined}
                onClick={(event: MouseEvent) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (!allowMenu) {
                    onActivate?.()
                    setOpenMenu(null)
                    return
                  }
                  const action = crumbButtonAction(crumb, index ? crumbs[index - 1] : undefined)
                  if (action === 'menu') {
                    if (open) {
                      setOpenMenu(null)
                      return
                    }
                    const box = event.currentTarget.getBoundingClientRect()
                    setOpenMenu({ id: crumb.id, left: Math.max(8, box.left), top: box.bottom + 4 })
                    return
                  }
                  onActivate?.()
                  onPick(action)
                  setOpenMenu(null)
                }}
              >
                {glyph}
              </button>
              )}
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
              onOpenId={(id) => {
                if (!id) setOpenMenu(null)
              }}
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