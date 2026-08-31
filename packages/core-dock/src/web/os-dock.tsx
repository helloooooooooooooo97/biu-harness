import { Fragment, useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { SlotProps } from '@biu/type-slots'
import type { DockApp, DockGroup, DockService } from './service.ts'

const DOCK_GROUPS: DockGroup[] = ['places', 'tools', 'tray']

const HIDE_MS = 280

function DockTile({ app, dock }: { app: DockApp; dock: DockService }) {
  const Tile = app.Tile as (() => ReactNode) | undefined
  const Icon = app.Icon as (() => ReactNode) | undefined
  const activate = () => {
    if (app.kind === 'module') {
      app.onOpen?.()
      return
    }
    if (app.minimized || !app.running) dock.open(app.id)
    else if (app.kind === 'composer' || app.kind === 'tool') dock.open(app.id)
    else dock.focus(app.id)
  }
  const className = `os-dock-item${app.focused ? ' is-focused' : ''}${app.running ? ' is-running' : ''}${app.minimized ? ' is-minimized' : ''}`
  const body = (
    <>
      <span className="os-dock-tile">
        {Tile ? <Tile /> : Icon ? <Icon /> : <span className="os-dock-fallback">{app.title.slice(0, 1)}</span>}
      </span>
      {app.running ? <span className="os-dock-dot" aria-hidden /> : null}
    </>
  )
  if (Tile) {
    return (
      <div className={className} data-dock-id={app.id} data-dock-kind={app.kind} title={app.title}>
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={className}
      data-dock-id={app.id}
      data-dock-kind={app.kind}
      aria-label={app.title}
      title={app.title}
      onClick={activate}
    >
      {body}
    </button>
  )
}

export function OsDock(props: SlotProps) {
  const dock = props.dock as DockService
  const apps = useSyncExternalStore(
    (listener) => dock.subscribe(listener),
    () => dock.list(),
    () => dock.list(),
  )
  const sections = DOCK_GROUPS.map((group) => ({
    group,
    apps: apps.filter((app) => app.group === group),
  })).filter((section) => section.apps.length)
  const [open, setOpen] = useState(false)
  const hideTimer = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const pointerOver = useRef(false)
  const show = useCallback(() => {
    pointerOver.current = true
    window.clearTimeout(hideTimer.current)
    setOpen(true)
  }, [])
  const hideSoon = useCallback((event?: { relatedTarget: EventTarget | null; clientX?: number; clientY?: number }) => {
    const related = event?.relatedTarget
    if (related instanceof Node && rootRef.current?.contains(related)) return
    if (related instanceof Element && related.closest('[data-os-dock]')) return
    pointerOver.current = false
    const x = event?.clientX
    const y = event?.clientY
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      if (pointerOver.current) return
      if (typeof y === 'number' && y >= window.innerHeight - 32) {
        pointerOver.current = true
        return
      }
      if (typeof x === 'number' && typeof y === 'number') {
        const hit = document.elementFromPoint(x, y)
        if (hit?.closest('[data-os-dock]')) {
          pointerOver.current = true
          return
        }
      }
      setOpen(false)
    }, HIDE_MS)
  }, [])
  if (!apps.length) return null
  return (
    <div
      ref={rootRef}
      className={`os-dock${open ? ' is-open' : ''}`}
      data-os-dock
      onPointerEnter={show}
      onPointerDown={show}
      onMouseEnter={show}
      onMouseLeave={(event) => hideSoon(event)}
      onFocusCapture={show}
      onBlurCapture={(event) => {
        if (pointerOver.current) return
        hideSoon(event)
      }}
    >
      <div className="os-dock-edge" aria-hidden />
      <div className="os-dock-peek" aria-hidden />
      <div className="os-dock-shelf">
        <div className="os-dock-shelf-row">
          {sections.map((section, index) => (
            <Fragment key={section.group}>
              {index > 0 ? <span className="os-dock-sep" aria-hidden /> : null}
              {section.apps.map((app) => (
                <DockTile key={app.id} app={app} dock={dock} />
              ))}
            </Fragment>
          ))}
        </div>
        <div className="os-dock-below" aria-hidden />
      </div>
    </div>
  )
}
