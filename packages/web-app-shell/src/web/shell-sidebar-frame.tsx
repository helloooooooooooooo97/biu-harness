import { memo, useEffect, useRef, type ReactNode } from 'react'
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/16/solid'
import { SidebarBrandLockup } from '@biu/public-mascot'
import { chromeIcon } from './chrome-icon.ts'
import { ShellSidePlaces } from './shell-chrome.tsx'

export type ShellSidebarFrameProps = {
  visible: boolean
  narrow?: boolean
  showTags?: boolean
  onCollapse?: () => void
  onExpand?: () => void
  onWidthChange?: (width: number) => void
  testId?: string
  activeId?: string
  agentHref?: string
  onSettings?: () => void
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
  activeId,
  agentHref,
  onSettings,
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
    <div className={`sidebar-flyout-host${visible ? '' : ' is-collapsed'}`} data-testid="sidebar-flyout-host">
      {visible ? null : <div className="sidebar-edge-hot" data-testid="sidebar-edge-hot" aria-hidden />}
    <aside
      className={`app-side-bar min-h-0 flex-col overflow-hidden border-r border-(--dsw-border) bg-(--dsw-sidebar)${narrow ? ' is-narrow' : ''}${showTags ? ' is-wide' : ''}${visible ? ' flex' : ' is-closed flex'}`}
      aria-hidden={!visible}
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
        <SidebarBrandLockup />
        {!visible || narrow ? (
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
      {onSettings && agentHref && activeId != null ? (
        <div className="shrink-0 px-2 pt-1">
          <ShellSidePlaces activeId={activeId} agentHref={agentHref} onSettings={onSettings} />
        </div>
      ) : null}
      {children}
    </aside>
    </div>
  )
})
