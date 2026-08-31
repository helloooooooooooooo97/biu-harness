import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  clampOverlayWinGeom,
  readOverlayWinGeom,
  writeOverlayWinGeom,
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
  const [geom, setGeom] = useState<OverlayWinGeom>(() => readOverlayWinGeom())
  const [z, setZ] = useState(overlayZ)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const resizeRef = useRef<(OverlayWinGeom & ResizeEdge & { px: number; py: number }) | null>(null)
  const geomRef = useRef(geom)
  geomRef.current = geom

  const bringFront = useCallback(() => {
    overlayZ += 1
    setZ(overlayZ)
  }, [])

  useEffect(() => {
    const onFocus = () => bringFront()
    window.addEventListener('biu:overlay-focus', onFocus)
    return () => window.removeEventListener('biu:overlay-focus', onFocus)
  }, [bringFront])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (drag) {
        setGeom(
          clampOverlayWinGeom(
            {
              ...geomRef.current,
              x: drag.x + event.clientX - drag.px,
              y: drag.y + event.clientY - drag.py,
            },
            window.innerWidth,
            window.innerHeight,
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
      }
      if (resize.north) {
        h = resize.h - dy
        y = resize.y + dy
      }
      setGeom(clampOverlayWinGeom({ x, y, w, h }, window.innerWidth, window.innerHeight))
    }
    const onUp = () => {
      if (dragRef.current || resizeRef.current) writeOverlayWinGeom(geomRef.current)
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
  }, [])

  const startDrag = (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest('button, input, textarea, [contenteditable="true"]')) return
    event.preventDefault()
    bringFront()
    dragRef.current = { px: event.clientX, py: event.clientY, x: geom.x, y: geom.y }
  }

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
    <div
      ref={boxRef}
      className="chat-overlay-panel"
      data-testid="chat-overlay-panel"
      data-biu-ignore
      style={{ top: geom.y, left: geom.x, width: geom.w, height: geom.h, zIndex: z }}
      onPointerDown={bringFront}
    >
      <div className="chat-overlay-drag" data-testid="chat-overlay-drag" onPointerDown={startDrag}>
        {header}
      </div>
      <div className="chat-overlay-thread">{thread}</div>
      <div className="chat-composer-dock">{dock}</div>
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
