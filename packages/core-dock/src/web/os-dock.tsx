import { useSyncExternalStore, type ReactNode } from 'react'
import type { SlotProps } from '@biu/type-slots'
import type { DockApp, DockService } from './service.ts'

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
  const pinned = apps.filter((app) => app.group === 'pinned')
  const running = apps.filter((app) => app.group === 'running')
  if (!apps.length) return null
  return (
    <div className="os-dock" data-os-dock>
      <div className="os-dock-shelf">
        {pinned.map((app) => (
          <DockTile key={app.id} app={app} dock={dock} />
        ))}
        {running.length ? <span className="os-dock-sep" aria-hidden /> : null}
        {running.map((app) => (
          <DockTile key={app.id} app={app} dock={dock} />
        ))}
      </div>
    </div>
  )
}
