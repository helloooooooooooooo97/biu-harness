import { memo, useEffect, useRef, type ReactNode } from 'react'
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/16/solid'
import { chromeIcon } from './chrome-icon.ts'

export const SIDEBAR_BRAND_GRADIENT =
  'linear-gradient(105deg, color-mix(in srgb, #0066B0 42%, var(--dsw-hover)), color-mix(in srgb, #5B3E90 40%, var(--dsw-hover)) 52%, color-mix(in srgb, #E22726 42%, var(--dsw-hover)))'

export type ShellSidebarFrameProps = {
  visible: boolean
  narrow?: boolean
  showTags?: boolean
  onCollapse?: () => void
  onExpand?: () => void
  onWidthChange?: (width: number) => void
  testId?: string
  children: ReactNode
}

/** 聊天与数据库共用的左侧栏外框：品牌头、收起/展开、拖宽。 */
export const ShellSidebarFrame = memo(function ShellSidebarFrame({
  visible,
  narrow = false,
  showTags = false,
  onCollapse,
  onExpand,
  onWidthChange,
  testId = 'shell-sidebar',
  children,
}: ShellSidebarFrameProps) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      onWidthChange?.(drag.startWidth + (event.clientX - drag.startX))
    }
    const onUp = () => {
      dragRef.current = null
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [onWidthChange])

  return (
    <aside
      className={`app-side-bar min-h-0 flex-col overflow-hidden border-r border-(--dsw-border) bg-(--dsw-sidebar)${narrow ? ' is-narrow' : ''}${showTags ? ' is-wide' : ''}${visible ? ' flex' : ' is-closed flex'}`}
      aria-hidden={!visible}
      inert={!visible || undefined}
      data-testid={testId}
    >
      {onWidthChange ? (
        <div
          className="sidebar-resize"
          data-biu-ignore
          data-testid="sidebar-resize"
          title="拖动调整宽度"
          onPointerDown={(event) => {
            event.preventDefault()
            const visual = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 0
            dragRef.current = { startX: event.clientX, startWidth: visual }
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
        />
      ) : null}
      <div className="app-side-bar-head app-side-bar-head-brand">
        <span
          className="inline-flex min-w-0 max-w-full items-center truncate rounded-md px-2 py-0.5 text-[14px] font-semibold tracking-wide text-white"
          style={{ background: SIDEBAR_BRAND_GRADIENT }}
        >
          Biu Agent OS
        </span>
        {narrow ? (
          <button
            type="button"
            className="chat-view-header-expand"
            title="展开左侧边栏"
            aria-label="展开左侧边栏"
            data-testid="sidebar-expand"
            onClick={onExpand}
          >
            <ChevronDoubleRightIcon {...chromeIcon} />
          </button>
        ) : (
          <button
            type="button"
            className="chat-view-header-expand"
            title="收起左侧边栏"
            aria-label="收起左侧边栏"
            data-testid="sidebar-collapse"
            onClick={onCollapse}
          >
            <ChevronDoubleLeftIcon {...chromeIcon} />
          </button>
        )}
      </div>
      {children}
    </aside>
  )
})
