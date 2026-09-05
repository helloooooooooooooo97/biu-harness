import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ChatPane } from '@biu/public-ui'
import {
  closeChatOverlay,
  overlayLayoutGeom,
  readOverlayWinState,
  writeOverlayWinState,
  type OverlayWinGeom,
} from './chat-overlay.ts'

type ResizeEdge = { north?: boolean; south?: boolean; east?: boolean; west?: boolean }

let overlayZ = 80

export function OverlayChatWindow({
  header,
  thread,
  dock,
}: {
  header: ReactNode
  thread: ReactNode
  dock: ReactNode
}) {
  const initial = readOverlayWinState()
  const [geom, setGeom] = useState<OverlayWinGeom>(initial)
  const [z, setZ] = useState(overlayZ)
  const boxRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<(OverlayWinGeom & ResizeEdge & { px: number; py: number }) | null>(null)
  const geomRef = useRef(geom)
  geomRef.current = geom

  const bringFront = useCallback(() => {
    overlayZ += 1
    setZ(overlayZ)
  }, [])

  const apply = useCallback((next: OverlayWinGeom, persist = true) => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const geom = overlayLayoutGeom('right', next, vw, vh)
    setGeom(geom)
    if (persist) writeOverlayWinState({ ...geom, layout: 'right' })
    return geom
  }, [])

  useEffect(() => {
    const onFocus = () => bringFront()
    window.addEventListener('biu:overlay-focus', onFocus)
    return () => window.removeEventListener('biu:overlay-focus', onFocus)
  }, [bringFront])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const onClose = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('[data-testid="chat-overlay-close"]')) return
      event.preventDefault()
      event.stopPropagation()
      closeChatOverlay()
    }
    el.addEventListener('pointerdown', onClose, true)
    return () => el.removeEventListener('pointerdown', onClose, true)
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
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
      }
      if (resize.north) {
        h = resize.h - dy
        y = resize.y + dy
      }
      apply({ x, y, w, h }, false)
    }
    const onUp = () => {
      if (resizeRef.current) {
        writeOverlayWinState({ ...geomRef.current, layout: 'right' })
      }
      resizeRef.current = null
    }
    const onResize = () => {
      apply(geomRef.current)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('resize', onResize)
    }
  }, [apply])

  const startResize = (edge: ResizeEdge) => (event: ReactPointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    bringFront()
    const el = boxRef.current
    const r = el?.getBoundingClientRect()
    resizeRef.current = {
      ...edge,
      x: geom.x,
      y: geom.y,
      w: r?.width ?? geom.w,
      h: r?.height ?? geom.h,
      px: event.clientX,
      py: event.clientY,
    }
  }

  const handles: Array<{ key: string; className: string; edge: ResizeEdge }> = [
    { key: 'n', className: 'absolute inset-x-8 top-0 h-1.5 cursor-n-resize', edge: { north: true } },
    { key: 's', className: 'absolute inset-x-2 bottom-0 h-1.5 cursor-s-resize', edge: { south: true } },
    { key: 'e', className: 'absolute inset-y-8 right-0 w-1.5 cursor-e-resize', edge: { east: true } },
    { key: 'w', className: 'absolute inset-y-2 left-0 w-1.5 cursor-w-resize', edge: { west: true } },
    { key: 'ne', className: 'pointer-events-none absolute top-0 right-0 size-3', edge: { north: true, east: true } },
    { key: 'nw', className: 'absolute top-0 left-0 size-3 cursor-nwse-resize', edge: { north: true, west: true } },
    { key: 'se', className: 'absolute bottom-0 right-0 size-3 cursor-nwse-resize', edge: { south: true, east: true } },
    { key: 'sw', className: 'absolute bottom-0 left-0 size-3 cursor-nesw-resize', edge: { south: true, west: true } },
  ]

  return (
    <div
      ref={boxRef}
      className="chat-overlay-panel"
      data-testid="chat-overlay-panel"
      data-overlay-layout="right"
      data-biu-ignore
      style={{ top: geom.y, left: geom.x, width: geom.w, height: geom.h, zIndex: z }}
      onPointerDown={bringFront}
    >
      <div className="chat-overlay-head" data-testid="chat-overlay-head">
        {header}
      </div>
      <ChatPane thread={thread} dock={dock} />
      {handles.map((item) => (
        <div
          key={item.key}
          className={`${item.className} z-10`}
          data-testid={`chat-overlay-resize-${item.key}`}
          onPointerDown={startResize(item.edge)}
        />
      ))}
    </div>
  )
}
