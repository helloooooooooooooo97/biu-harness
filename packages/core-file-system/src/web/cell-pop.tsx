import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { listenOutsideDismiss } from '@biu/public-ui'
import type { FieldType } from '@biu/type-file-system'

export function cellUsesPop(kind: FieldType, writable?: boolean) {
  if (!writable) return false
  return kind !== 'action' && kind !== 'file' && kind !== 'boolean'
}

export function CellPop({
  open,
  anchor,
  onClose,
  className,
  children,
}: {
  open: boolean
  anchor: HTMLElement | null
  onClose: () => void
  className?: string
  children: ReactNode
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const openedAt = useRef(performance.now())
  const [box, setBox] = useState({ top: 0, left: 0, width: 200, minHeight: 32 })

  useLayoutEffect(() => {
    if (!open || !anchor) return
    openedAt.current = performance.now()
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      setBox({
        top: rect.top,
        left: rect.left,
        width: Math.max(rect.width, 240),
        minHeight: Math.max(rect.height, 32),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, open])

  useEffect(() => {
    if (!open) return
    const close = () => {
      if (performance.now() - openedAt.current < 200) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const stop = listenOutsideDismiss(close, (target) => {
      if (!(target instanceof Element)) return Boolean(menuRef.current?.contains(target) || anchor?.contains(target))
      if (menuRef.current?.contains(target) || anchor?.contains(target)) return true
      return Boolean(target.closest('.db-search-menu, .fsdb-cellselect-menu, .fsdb-cell-pop, .ant-picker-dropdown'))
    })
    return () => {
      window.removeEventListener('keydown', onKey)
      stop()
    }
  }, [anchor, onClose, open])

  if (!open || !anchor) return null
  return createPortal(
    <div
      ref={menuRef}
      className={`fsdb-cell-pop${className ? ` ${className}` : ''}`}
      role="dialog"
      style={{ position: 'fixed', top: box.top, left: box.left, width: box.width, minHeight: box.minHeight, zIndex: 180 }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}
