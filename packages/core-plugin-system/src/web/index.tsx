import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Context } from 'cordis'
import { useSlotEntries, type SlotsService } from '@biu/web-slots'
import type { SlotProps } from '@biu/type-slots'

import type { DatabaseUi } from '@biu/type-file-system/ui'
import { pluginsChrome } from './chrome.tsx'

export const name = 'core-plugin-system-ui'
export const inject = ['slots', 'databaseUi']

type StoreListing = { id: string; name: string }

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(body.error || res.statusText)
  return body
}

function resolveListing(extraId: string, items: StoreListing[]) {
  return (
    items.find((item) => item.id === extraId) ??
    items
      .filter((item) => extraId.startsWith(`${item.id}-`))
      .sort((a, b) => b.id.length - a.id.length)[0] ??
    null
  )
}

const WIN_MIN_W = 200
const WIN_MIN_H = 160
const WIN_CHROME_H = 32
const WIN_DEFAULT_W = 480
const WIN_DEFAULT_H = 360
let pluginWindowZ = 21

type WinGeom = { x: number; y: number; w: number; h: number }
type ResizeEdge = { north?: boolean; south?: boolean; east?: boolean; west?: boolean }
type ResizeSession = WinGeom & ResizeEdge & { px: number; py: number }

function defaultPos(seed: string): { x: number; y: number } {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return {
    x: Math.max(16, Math.round(window.innerWidth / 2 - 160) + (hash % 5) * 28 - 56),
    y: Math.max(16, Math.round(window.innerHeight / 2 - 120) + (hash % 4) * 24 - 48),
  }
}

function clampGeom(next: WinGeom, lockSize: boolean): WinGeom {
  const maxX = Math.max(0, window.innerWidth - 64)
  const maxY = Math.max(0, window.innerHeight - 36)
  return {
    x: Math.min(maxX, Math.max(0, next.x)),
    y: Math.min(maxY, Math.max(0, next.y)),
    w: lockSize ? Math.min(window.innerWidth, Math.max(WIN_MIN_W, next.w)) : next.w,
    h: lockSize ? Math.min(window.innerHeight, Math.max(WIN_MIN_H, next.h)) : next.h,
  }
}

function innerHasExplicitSize(el: HTMLElement | null): { w: boolean; h: boolean } {
  if (!el) return { w: false, h: false }
  return {
    w: Boolean(el.style.width) || el.hasAttribute('width'),
    h: Boolean(el.style.height) || el.hasAttribute('height'),
  }
}

function measurePluginBox(body: HTMLElement): { w: number; h: number } {
  const inner = body.firstElementChild as HTMLElement | null
  const explicit = innerHasExplicitSize(inner)
  const w = explicit.w && inner ? inner.offsetWidth : WIN_DEFAULT_W
  const contentH = explicit.h && inner ? inner.offsetHeight : WIN_DEFAULT_H
  return {
    w: Math.max(WIN_MIN_W, w),
    h: Math.max(WIN_MIN_H, contentH + WIN_CHROME_H),
  }
}

function PluginAppWindow({
  extraId,
  title,
  pluginId,
  fullscreen,
  onClose,
  onMinimize,
  onToggleFullscreen,
  children,
}: {
  extraId: string
  title: string
  pluginId: string
  fullscreen: boolean
  onClose: () => void
  onMinimize: () => void
  onToggleFullscreen: () => void
  children: ReactNode
}) {
  const [geom, setGeom] = useState<WinGeom>(() => ({
    ...defaultPos(extraId),
    w: WIN_DEFAULT_W,
    h: WIN_DEFAULT_H + WIN_CHROME_H,
  }))
  const [userSized, setUserSized] = useState(false)
  const [z, setZ] = useState(() => ++pluginWindowZ)
  const boxRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const centeredRef = useRef(false)
  const dragRef = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const resizeRef = useRef<ResizeSession | null>(null)

  useEffect(() => {
    if (userSized || fullscreen) return
    const body = bodyRef.current
    const box = boxRef.current
    if (!body || !box) return
    const applyMeasure = () => {
      const size = measurePluginBox(body)
      setGeom((cur) => {
        const next = { ...cur, ...size }
        if (!centeredRef.current) {
          centeredRef.current = true
          next.x = Math.max(16, Math.round((window.innerWidth - size.w) / 2))
          next.y = Math.max(16, Math.round((window.innerHeight - size.h) / 2))
        }
        return clampGeom(next, true)
      })
    }
    applyMeasure()
    const id = window.requestAnimationFrame(applyMeasure)
    const inner = body.firstElementChild
    const ro = inner ? new ResizeObserver(applyMeasure) : null
    if (inner) ro?.observe(inner)
    return () => {
      window.cancelAnimationFrame(id)
      ro?.disconnect()
    }
  }, [userSized, fullscreen])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (drag) {
        setGeom((cur) =>
          clampGeom(
            {
              ...cur,
              x: drag.x + event.clientX - drag.px,
              y: drag.y + event.clientY - drag.py,
            },
            userSized,
          ),
        )
        return
      }
      const resize = resizeRef.current
      if (!resize) return
      const dx = event.clientX - resize.px
      const dy = event.clientY - resize.py
      let { x, y, w, h } = resize
      if (resize.east) w = resize.w + dx
      if (resize.south) h = resize.h + dy
      if (resize.west) {
        w = resize.w - dx
        x = resize.x + dx
        if (w < WIN_MIN_W) {
          x = resize.x + resize.w - WIN_MIN_W
          w = WIN_MIN_W
        }
      }
      if (resize.north) {
        h = resize.h - dy
        y = resize.y + dy
        if (h < WIN_MIN_H) {
          y = resize.y + resize.h - WIN_MIN_H
          h = WIN_MIN_H
        }
      }
      setUserSized(true)
      setGeom(clampGeom({ x, y, w, h }, true))
    }
    const onUp = () => {
      dragRef.current = null
      resizeRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [userSized])

  const bringFront = () => setZ(++pluginWindowZ)

  const startDrag = (event: ReactPointerEvent) => {
    if (fullscreen) return
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    bringFront()
    dragRef.current = { px: event.clientX, py: event.clientY, x: geom.x, y: geom.y }
  }

  const startResize = (edge: ResizeEdge) => (event: ReactPointerEvent) => {
    if (fullscreen) return
    event.preventDefault()
    event.stopPropagation()
    bringFront()
    const el = boxRef.current
    const r = el?.getBoundingClientRect()
    const current = {
      ...geom,
      w: r?.width ?? geom.w,
      h: r?.height ?? geom.h,
    }
    resizeRef.current = { ...edge, ...current, px: event.clientX, py: event.clientY }
  }

  const style = fullscreen
    ? { top: 16, left: 16, width: 'calc(100vw - 32px)', height: 'calc(100vh - 32px)', zIndex: z + 8 }
    : { top: geom.y, left: geom.x, width: geom.w, height: geom.h, zIndex: z }

  const handles: Array<{ key: string; className: string; edge: ResizeEdge }> = [
    { key: 'n', className: 'absolute inset-x-2 top-0 h-1.5 cursor-n-resize', edge: { north: true } },
    { key: 's', className: 'absolute inset-x-2 bottom-0 h-1.5 cursor-s-resize', edge: { south: true } },
    { key: 'e', className: 'absolute inset-y-2 right-0 w-1.5 cursor-e-resize', edge: { east: true } },
    { key: 'w', className: 'absolute inset-y-2 left-0 w-1.5 cursor-w-resize', edge: { west: true } },
    { key: 'ne', className: 'absolute top-0 right-0 size-3 cursor-nesw-resize', edge: { north: true, east: true } },
    { key: 'nw', className: 'absolute top-0 left-0 size-3 cursor-nwse-resize', edge: { north: true, west: true } },
    { key: 'se', className: 'absolute bottom-0 right-0 size-3 cursor-nwse-resize', edge: { south: true, east: true } },
    { key: 'sw', className: 'absolute bottom-0 left-0 size-3 cursor-nesw-resize', edge: { south: true, west: true } },
  ]

  return (
    <section
      ref={boxRef}
      className="group/win pointer-events-auto fixed flex min-h-0 min-w-0 flex-col overflow-hidden bg-transparent text-(--dsw-label)"
      style={style}
      data-testid={`plugin-app-window-${extraId}`}
      data-plugin-id={pluginId}
      data-fullscreen={fullscreen || undefined}
      onPointerDown={bringFront}
    >
      <header
        className={`flex h-8 shrink-0 items-center gap-3 bg-transparent px-3 opacity-0 transition-opacity duration-150 group-hover/win:opacity-100 ${fullscreen ? '' : 'cursor-grab active:cursor-grabbing'}`}
        onPointerDown={startDrag}
      >
        <div className="group/traffic flex items-center gap-1.75">
          <button
            type="button"
            className="relative size-3 cursor-pointer rounded-full border-0 bg-[#ff5f57] p-0 shadow-[inset_0_0_0_.5px_rgba(0,0,0,.28)]"
            title="关闭"
            aria-label={`关闭 ${title}`}
            onClick={onClose}
          >
            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[8px] leading-none font-bold text-[#4d0000] group-hover/traffic:flex">
              ×
            </span>
          </button>
          <button
            type="button"
            className="relative size-3 cursor-pointer rounded-full border-0 bg-[#febc2e] p-0 shadow-[inset_0_0_0_.5px_rgba(0,0,0,.28)]"
            title="最小化"
            aria-label={`最小化 ${title}`}
            onClick={onMinimize}
          >
            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[9px] leading-none font-bold text-[#985700] group-hover/traffic:flex">
              −
            </span>
          </button>
          <button
            type="button"
            className="relative size-3 cursor-pointer rounded-full border-0 bg-[#28c840] p-0 shadow-[inset_0_0_0_.5px_rgba(0,0,0,.28)]"
            title={fullscreen ? '还原' : '全屏'}
            aria-label={fullscreen ? `还原 ${title}` : `全屏 ${title}`}
            onClick={onToggleFullscreen}
          >
            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[7px] leading-none font-bold text-[#0b5f18] group-hover/traffic:flex">
              {fullscreen ? '↘' : '↗'}
            </span>
          </button>
        </div>
        <div className="min-w-0 flex-1 truncate text-center text-[12px] font-medium tracking-tight text-white/70">
          {title}
        </div>
        <span className="w-13 shrink-0" aria-hidden />
      </header>
      <div ref={bodyRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-transparent">
        {children}
      </div>
      {fullscreen
        ? null
        : handles.map((item) => (
            <div
              key={item.key}
              className={`${item.className} pointer-events-none z-10 opacity-0 group-hover/win:pointer-events-auto group-hover/win:opacity-100`}
              onPointerDown={startResize(item.edge)}
            />
          ))}
    </section>
  )
}

function PluginExtrasLayer(props: SlotProps) {
  const slots = props.slots as SlotsService
  const extras = useSlotEntries(slots, 'plugin-store-extras')
  const [listings, setListings] = useState<StoreListing[]>([])
  const [minimized, setMinimized] = useState<Record<string, boolean>>({})
  const [fullscreenId, setFullscreenId] = useState<string | null>(null)

  useEffect(() => {
    if (extras.length === 0) return
    let cancelled = false
    const load = () => {
      void readJson<{ items: StoreListing[] }>('/api/db/list?path=/plugins')
        .then((data) => {
          if (!cancelled) setListings(data.items ?? [])
        })
        .catch(() => {
          if (!cancelled) setListings([])
        })
    }
    load()
    const timer = window.setInterval(load, 3000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [extras.map((item) => item.id).join('|')])

  async function closePlugin(id: string) {
    try {
      await readJson('/api/db/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: `/plugins/${id}`, action: 'stop' }),
      })
    } catch {
      /* extras 卸载后窗口会消失 */
    }
  }

  if (extras.length === 0) return null
  const sorted = [...extras].sort((a, b) => a.order - b.order)
  const hidden = sorted.filter((entry) => minimized[entry.id])
  return (
    <div className="pointer-events-none fixed inset-0 z-20" data-testid="plugin-store-extras">
      {sorted.map((entry) => {
        if (minimized[entry.id]) return null
        const listing = resolveListing(entry.id, listings)
        const pluginId = listing?.id ?? entry.id
        const title = listing?.name ?? entry.id
        const Component = entry.Component
        return (
          <PluginAppWindow
            key={entry.id}
            extraId={entry.id}
            title={title}
            pluginId={pluginId}
            fullscreen={fullscreenId === entry.id}
            onClose={() => {
              setMinimized((cur) => {
                const next = { ...cur }
                delete next[entry.id]
                return next
              })
              if (fullscreenId === entry.id) setFullscreenId(null)
              void closePlugin(pluginId)
            }}
            onMinimize={() => {
              if (fullscreenId === entry.id) setFullscreenId(null)
              setMinimized((cur) => ({ ...cur, [entry.id]: true }))
            }}
            onToggleFullscreen={() => setFullscreenId((cur) => (cur === entry.id ? null : entry.id))}
          >
            <Component renderSlot={() => null} />
          </PluginAppWindow>
        )
      })}
      {hidden.length ? (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
          {hidden.map((entry) => {
            const listing = resolveListing(entry.id, listings)
            const title = listing?.name ?? entry.id
            return (
              <button
                key={entry.id}
                type="button"
                className="rounded-lg border border-white/10 bg-[#3a3a3c] px-3 py-1.5 text-[11px] font-medium text-white/85 shadow-[0_8px_24px_rgba(0,0,0,.35)]"
                title={`还原 ${title}`}
                onClick={() =>
                  setMinimized((cur) => {
                    const next = { ...cur }
                    delete next[entry.id]
                    return next
                  })
                }
              >
                {title}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function apply(ctx: Context) {
  const slots = ctx.get('slots') as SlotsService | undefined
  if (!slots) throw new Error('slots service required')
  const ui = ctx.get('databaseUi') as DatabaseUi
  ctx.effect(() => ui.decorate('/plugins', pluginsChrome).dispose)
  slots.place('root-overlays', PluginExtrasLayer, {
    key: 'plugin-store-extras-layer',
    order: 20,
    props: () => ({ slots }),
    children: {
      'plugin-store-extras': { kind: 'list' },
    },
  })
}
